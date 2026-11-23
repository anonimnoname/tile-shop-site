// Web Push без внешних библиотек: VAPID (RFC 8292) + шифрование aes128gcm (RFC 8291).
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace TileShop;

public sealed class WebPush
{
    readonly ECDsa _signer;
    public string PublicKey { get; }
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    WebPush(ECDsa signer)
    {
        _signer = signer;
        var p = signer.ExportParameters(false);
        PublicKey = B64U.Encode([0x04, .. p.Q.X!, .. p.Q.Y!]);
    }

    /// Ключи сервера хранятся в data/vapid.json и создаются один раз.
    public static WebPush Load(string file)
    {
        var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        if (File.Exists(file))
        {
            var j = JsonNode.Parse(File.ReadAllText(file))!;
            if (j["privateKeyPkcs8"] is JsonValue v)
            {
                ec.ImportPkcs8PrivateKey(Convert.FromBase64String(v.GetValue<string>()), out _);
                return new WebPush(ec);
            }
        }
        var data = new JsonObject { ["privateKeyPkcs8"] = Convert.ToBase64String(ec.ExportPkcs8PrivateKey()) };
        File.WriteAllText(file, data.ToJsonString());
        return new WebPush(ec);
    }

    string VapidHeader(string endpoint, string subject)
    {
        var aud = new Uri(endpoint).GetLeftPart(UriPartial.Authority);
        var header = B64U.Encode(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
        var payload = B64U.Encode(JsonSerializer.SerializeToUtf8Bytes(new { aud, exp = DateTimeOffset.UtcNow.AddHours(12).ToUnixTimeSeconds(), sub = subject }));
        // .NET подписывает в формате r||s (IEEE P1363) — как требует JWT ES256
        var sig = _signer.SignData(Encoding.ASCII.GetBytes(header + "." + payload), HashAlgorithmName.SHA256);
        return $"vapid t={header}.{payload}.{B64U.Encode(sig)}, k={PublicKey}";
    }

    /// Шифрует сообщение ключами подписки браузера (p256dh + auth).
    public static byte[] Encrypt(byte[] plaintext, string p256dh, string auth)
    {
        var uaPublic = B64U.Decode(p256dh);
        var authSecret = B64U.Decode(auth);
        using var ua = ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint { X = uaPublic[1..33], Y = uaPublic[33..65] }
        });
        using var local = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var lp = local.ExportParameters(false);
        byte[] asPublic = [0x04, .. lp.Q.X!, .. lp.Q.Y!];
        var shared = local.DeriveRawSecretAgreement(ua.PublicKey);

        var prkKey = HMACSHA256.HashData(authSecret, shared);
        byte[] keyInfo = [.. "WebPush: info\0"u8, .. uaPublic, .. asPublic, 1];
        var ikm = HMACSHA256.HashData(prkKey, keyInfo);
        var salt = RandomNumberGenerator.GetBytes(16);
        var prk = HMACSHA256.HashData(salt, ikm);
        byte[] cekInfo = [.. "Content-Encoding: aes128gcm\0"u8, 1];
        var cek = HMACSHA256.HashData(prk, cekInfo)[..16];
        byte[] nonceInfo = [.. "Content-Encoding: nonce\0"u8, 1];
        var nonce = HMACSHA256.HashData(prk, nonceInfo)[..12];

        byte[] padded = [.. plaintext, 2]; // 0x02 — последняя запись
        var cipher = new byte[padded.Length];
        var tag = new byte[16];
        using (var gcm = new AesGcm(cek, 16)) gcm.Encrypt(nonce, padded, cipher, tag);

        var rs = new byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(rs, 4096);
        return [.. salt, .. rs, (byte)asPublic.Length, .. asPublic, .. cipher, .. tag];
    }

    /// Отправка одного уведомления; возвращает HTTP-код (404/410 — подписка больше не действует).
    public async Task<int> Send(JsonNode sub, object data, string subject)
    {
        try
        {
            var endpoint = sub["endpoint"]!.GetValue<string>();
            var body = Encrypt(JsonSerializer.SerializeToUtf8Bytes(data), sub["keys"]!["p256dh"]!.GetValue<string>(), sub["keys"]!["auth"]!.GetValue<string>());
            using var req = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = new ByteArrayContent(body) };
            req.Content.Headers.ContentType = new("application/octet-stream");
            req.Content.Headers.ContentEncoding.Add("aes128gcm");
            req.Headers.TryAddWithoutValidation("TTL", "86400");
            req.Headers.TryAddWithoutValidation("Urgency", "high");
            req.Headers.TryAddWithoutValidation("Authorization", VapidHeader(endpoint, subject));
            using var res = await Http.SendAsync(req);
            return (int)res.StatusCode;
        }
        catch (Exception) { return 0; }
    }
}

public static class B64U
{
    public static string Encode(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public static byte[] Decode(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
