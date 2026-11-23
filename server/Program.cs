// Сервер магазина плитки на ASP.NET Core (.NET 10). Внешних пакетов нет.
//
//   dotnet run                        — запустить (порт из PORT, по умолчанию 3000)
//   dotnet run -- set-password        — задать или сменить пароль админки
//
// Данные: папка data/ (товары, заказы, настройки, пароль, ключи push), фото — public/uploads/.
using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.FileProviders;
using TileShop;

// ---------------- пути и настройки ----------------
string FindRoot()
{
    foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
    {
        var d = new DirectoryInfo(start);
        while (d != null)
        {
            if (File.Exists(Path.Combine(d.FullName, "public", "index.html"))) return d.FullName;
            d = d.Parent;
        }
    }
    return Directory.GetCurrentDirectory();
}
var root = Environment.GetEnvironmentVariable("SITE_ROOT") ?? FindRoot();
var publicDir = Path.GetFullPath(Environment.GetEnvironmentVariable("PUBLIC_DIR") ?? Path.Combine(root, "public"));
var dataDir = Path.GetFullPath(Environment.GetEnvironmentVariable("DATA_DIR") ?? Path.Combine(root, "data"));
var uploadsDir = Path.Combine(publicDir, "uploads");
Directory.CreateDirectory(dataDir);
Directory.CreateDirectory(uploadsDir);
var port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var pp) ? pp : 3000;
var host = Environment.GetEnvironmentVariable("HOST") ?? "127.0.0.1"; // наружу — через Caddy (HTTPS)
var adminPath = "/" + Regex.Replace(Environment.GetEnvironmentVariable("ADMIN_PATH") ?? "admin", @"[^\w-]", "") is var ap && ap == "/" ? "/admin" : ap;
var adminIps = (Environment.GetEnvironmentVariable("ADMIN_IPS") ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
var tgToken = Environment.GetEnvironmentVariable("TG_BOT_TOKEN") ?? "";
var tgChat = Environment.GetEnvironmentVariable("TG_CHAT_ID") ?? "";

var store = new Store(dataDir, publicDir);

// ---------------- команда: пароль ----------------
if (args.Length > 0 && args[0] == "set-password")
{
    Console.Write("Новый пароль админки (минимум 8 символов): ");
    var pw = Console.ReadLine() ?? "";
    if (pw.Length < 8) { Console.Error.WriteLine("Слишком короткий пароль."); return 1; }
    store.SetPassword(pw);
    Console.WriteLine("Пароль сохранён. Перезапустите сервер, если он запущен.");
    return 0;
}
// проверка шифрования push (для тестов): push-selftest <p256dh> <auth> <текст>
if (args.Length == 4 && args[0] == "push-selftest")
{
    Console.WriteLine(Convert.ToBase64String(WebPush.Encrypt(Encoding.UTF8.GetBytes(args[3]), args[1], args[2])));
    return 0;
}
if (store.Admin == null && Environment.GetEnvironmentVariable("ADMIN_PASSWORD") is { Length: >= 8 } envPw) store.SetPassword(envPw);

var push = WebPush.Load(Path.Combine(dataDir, "vapid.json"));
var sessions = new ConcurrentDictionary<string, DateTime>();
var hits = new ConcurrentDictionary<string, List<DateTime>>();
var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = root, WebRootPath = publicDir });
builder.WebHost.UseUrls($"http://{host}:{port}");
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 8 * 1024 * 1024);
builder.Logging.SetMinimumLevel(LogLevel.Warning);
var app = builder.Build();

// ---------------- помощники ----------------
string Ip(HttpContext c) => (c.Request.Headers["X-Forwarded-For"].ToString().Split(',')[0].Trim() is { Length: > 0 } f ? f : c.Connection.RemoteIpAddress?.ToString() ?? "").Replace("::ffff:", "");
bool Secure(HttpContext c) => c.Request.Headers["X-Forwarded-Proto"] == "https" || c.Request.IsHttps;
bool AdminAllowed(HttpContext c) => adminIps.Length == 0 || adminIps.Contains(Ip(c));
bool Limited(string key, int max, TimeSpan window)
{
    var now = DateTime.UtcNow;
    var list = hits.GetOrAdd(key, _ => new List<DateTime>());
    lock (list) { list.RemoveAll(t => now - t > window); list.Add(now); return list.Count > max; }
}
bool IsAdmin(HttpContext c) => c.Request.Cookies.TryGetValue("sid", out var sid) && sessions.TryGetValue(sid, out var exp) && exp > DateTime.UtcNow;
bool SameOrigin(HttpContext c)
{
    var o = c.Request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(o)) return true;
    return Uri.TryCreate(o, UriKind.Absolute, out var u) && u.Authority == c.Request.Host.Value;
}
static IResult Err(int code, string msg) => Results.Json(new { error = msg }, statusCode: code);
static async Task<JsonObject> ReadJson(HttpContext c, int limit)
{
    if (c.Request.ContentLength > limit) throw new ApiError(413, "Слишком большой запрос");
    using var ms = new MemoryStream();
    var buf = new byte[16384]; int n;
    while ((n = await c.Request.Body.ReadAsync(buf)) > 0)
    {
        ms.Write(buf, 0, n);
        if (ms.Length > limit) throw new ApiError(413, "Слишком большой запрос");
    }
    if (ms.Length == 0) return new JsonObject();
    try { return JsonNode.Parse(ms.ToArray()) as JsonObject ?? throw new ApiError(400, "Неверный JSON"); }
    catch (JsonException) { throw new ApiError(400, "Неверный JSON"); }
}
var fmt = (decimal v) => Math.Round(v).ToString("#,0", System.Globalization.CultureInfo.InvariantCulture).Replace(",", " ");

async Task Notify(string text)
{
    if (tgToken == "" || tgChat == "") return;
    try { await http.PostAsJsonAsync($"https://api.telegram.org/bot{tgToken}/sendMessage", new { chat_id = tgChat, text, disable_web_page_preview = true }); }
    catch (Exception e) { Console.Error.WriteLine("Telegram: " + e.Message); }
}
async Task<int[]> PushAll(object data)
{
    var subs = store.PushSubs();
    if (subs.Count == 0) return [];
    var subject = store.Settings["siteOrigin"]?.GetValue<string>() ?? "mailto:admin@example.com";
    var results = await Task.WhenAll(subs.Select(s => push.Send(s, data, subject)));
    store.RemovePush(subs.Where((s, i) => results[i] is 404 or 410).Select(s => s["endpoint"]!.GetValue<string>()));
    return results;
}

// ---------------- безопасность и ошибки ----------------
app.Use(async (c, next) =>
{
    c.Response.Headers["X-Content-Type-Options"] = "nosniff";
    c.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    try { await next(); }
    catch (ApiError e) { if (!c.Response.HasStarted) await Err(e.Code, e.Message).ExecuteAsync(c); }
});
// Запросы, меняющие данные, — только со своего сайта
app.Use(async (c, next) =>
{
    if (c.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(c.Request.Method) && !SameOrigin(c)) { await Err(403, "Запрос с чужого сайта").ExecuteAsync(c); return; }
    if ((c.Request.Path == "/api/login" || c.Request.Path.StartsWithSegments("/api/admin")) && !AdminAllowed(c)) { await Err(404, "Не найдено").ExecuteAsync(c); return; }
    if (c.Request.Path.StartsWithSegments("/api/admin") && !IsAdmin(c)) { await Err(401, "Нужно войти").ExecuteAsync(c); return; }
    await next();
});

// ---------------- админка по своему адресу ----------------
app.Use(async (c, next) =>
{
    var p = c.Request.Path.Value ?? "";
    if (p.Equals(adminPath + "/", StringComparison.OrdinalIgnoreCase)) { c.Response.Redirect(adminPath); return; }
    if (p.Equals(adminPath, StringComparison.OrdinalIgnoreCase))
    {
        if (!AdminAllowed(c)) { c.Response.StatusCode = 404; return; }
        c.Response.ContentType = "text/html; charset=utf-8";
        c.Response.Headers.CacheControl = "no-cache";
        c.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
        await c.Response.SendFileAsync(Path.Combine(publicDir, "admin", "admin.html"));
        return;
    }
    if (p.Equals("/admin/admin.html", StringComparison.OrdinalIgnoreCase)) { c.Response.StatusCode = 404; return; } // только по своему адресу
    await next();
});

// ---------------- статика (сайт) ----------------
app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(publicDir) });
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(publicDir),
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? "";
        ctx.Context.Response.Headers.CacheControl =
            path.EndsWith(".html") || path == "/" || path.Contains("/data/") ? "no-cache" :
            path.StartsWith("/uploads/") || path.Contains("/vendor/") ? "public, max-age=2592000" : "public, max-age=3600";
        if (path.EndsWith(".html") || path == "/") ctx.Context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    }
});

// ---------------- публичное API ----------------
app.MapGet("/api/catalog", (HttpContext c) =>
{
    c.Response.Headers.CacheControl = "public, max-age=60";
    return Results.Json(new JsonObject { ["products"] = store.PublicProducts(), ["settings"] = store.PublicSettings() });
});

app.MapPost("/api/orders", async (HttpContext c) =>
{
    if (Limited("order:" + Ip(c), 8, TimeSpan.FromHours(1))) return Err(429, "Слишком много заказов подряд. Попробуйте позже или напишите нам.");
    var b = await ReadJson(c, 64 * 1024);
    if (V.Str(b["website"], 100) != "") return Results.Json(new { ok = true, id = 0 }); // ловушка для ботов
    var order = store.CreateOrder(b); // проверяет поля и пересчитывает цены по своему каталогу
    var cur = store.Settings["currency"]?.GetValue<string>() ?? "сум";
    var cust = order["customer"]!; var rec = order["recipient"]!; var addr = order["address"]!;
    var total = order["total"].Dec();
    var lines = new List<string> {
        $"🧱 Новый заказ №{order["id"]}",
        $"Заказчик: {cust["name"]}, {cust["phone"]} ({(V.Str(cust["contact"], 20) is { Length: > 0 } ct ? ct : "любой способ")})",
        $"Получатель: {rec["name"]}, {rec["phone"]}",
        $"Адрес: {addr["city"]}, {addr["street"]}"
    };
    foreach (var i in order["items"]!.AsArray()) lines.Add($"• {i!["name"]} {i["size"]}: {i["boxes"]} кор. ({i["m2"]} м²) = {fmt(i["sum"].Dec())}");
    lines.Add($"Итого: {fmt(total)} {cur}");
    if (V.Str(order["comment"], 1000) is { Length: > 0 } cm) lines.Add("Комментарий: " + cm);
    _ = Notify(string.Join("\n", lines));
    _ = PushAll(new { title = $"Новый заказ №{order["id"]} — {fmt(total)} {cur}", body = $"{cust["name"]}, {cust["phone"]} → {addr["city"]}. {order["items"]!.AsArray().Count} поз.", url = adminPath, tag = "order-" + order["id"] });
    return Results.Json(new { ok = true, id = order["id"].Int(), total });
});

app.MapPost("/api/login", async (HttpContext c) =>
{
    if (Limited("login:" + Ip(c), 6, TimeSpan.FromMinutes(15))) return Err(429, "Слишком много попыток. Подождите 15 минут.");
    var b = await ReadJson(c, 4096);
    if (store.Admin == null) return Err(503, "Пароль ещё не задан. На сервере выполните: dotnet TileShop.Server.dll set-password");
    if (!store.CheckPassword(V.Str(b["password"], 200))) return Err(401, "Неверный пароль");
    var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    sessions[token] = DateTime.UtcNow.AddDays(30);
    c.Response.Cookies.Append("sid", token, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, Secure = Secure(c), Path = "/", MaxAge = TimeSpan.FromDays(30) });
    return Results.Json(new { ok = true });
});
app.MapPost("/api/logout", (HttpContext c) =>
{
    if (c.Request.Cookies.TryGetValue("sid", out var sid)) sessions.TryRemove(sid, out _);
    c.Response.Cookies.Delete("sid", new CookieOptions { Path = "/" });
    return Results.Json(new { ok = true });
});

// ---------------- админка (только после входа) ----------------
var adm = app.MapGroup("/api/admin");
adm.MapGet("/me", () => Results.Json(new { ok = true }));

adm.MapGet("/push/key", () => Results.Json(new { publicKey = push.PublicKey, count = store.PushSubs().Count }));
adm.MapPost("/push/subscribe", async (HttpContext c) =>
{
    var b = await ReadJson(c, 8192);
    var sb = b["subscription"] as JsonObject ?? throw new ApiError(400, "Неверная подписка");
    var ep = V.Str(sb["endpoint"], 1000);
    var p256 = V.Str(sb["keys"]?["p256dh"], 200); var auth = V.Str(sb["keys"]?["auth"], 100);
    if (!ep.StartsWith("https://") || p256 == "" || auth == "") throw new ApiError(400, "Неверная подписка");
    var count = store.AddPush(new JsonObject { ["endpoint"] = ep, ["keys"] = new JsonObject { ["p256dh"] = p256, ["auth"] = auth }, ["device"] = V.Str(b["device"], 120), ["at"] = DateTime.UtcNow.ToString("o") });
    store.UpdateSettings(s => s["siteOrigin"] = (Secure(c) ? "https://" : "http://") + c.Request.Host.Value);
    return Results.Json(new { ok = true, count });
});
adm.MapPost("/push/test", async () =>
{
    var r = await PushAll(new { title = "Уведомления работают ✓", body = "Так будут приходить новые заказы с сайта.", url = adminPath, tag = "test" });
    return Results.Json(new { ok = true, sent = r.Count(x => x is >= 200 and < 300), count = store.PushSubs().Count });
});

adm.MapGet("/products", () => Results.Json(store.AllProducts()));
adm.MapPost("/products", async (HttpContext c) => Results.Json(store.AddProduct(await ReadJson(c, 64 * 1024))));
adm.MapPut("/products/{id}", async (HttpContext c, string id) => store.UpdateProduct(id, await ReadJson(c, 64 * 1024)) is { } p ? Results.Json(p) : Err(404, "Товар не найден"));
adm.MapMethods("/products/{id}", ["PATCH"], async (HttpContext c, string id) => store.PatchProduct(id, await ReadJson(c, 4096)) is { } p ? Results.Json(p) : Err(404, "Товар не найден"));
adm.MapDelete("/products/{id}", (string id) => store.DeleteProduct(id) ? Results.Json(new { ok = true }) : Err(404, "Товар не найден"));

adm.MapPost("/upload", async (HttpContext c) =>
{
    var b = await ReadJson(c, 6 * 1024 * 1024);
    var m = Regex.Match(V.Str(b["dataUrl"], 7_000_000), @"^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$");
    if (!m.Success) throw new ApiError(400, "Нужна картинка JPG, PNG или WEBP");
    var bytes = Convert.FromBase64String(m.Groups[2].Value);
    var kind = m.Groups[1].Value;
    var ok = kind switch
    {
        "jpeg" => bytes.Length > 2 && bytes[0] == 0xFF && bytes[1] == 0xD8,
        "png" => bytes.Length > 2 && bytes[0] == 0x89 && bytes[1] == 0x50,
        _ => bytes.Length > 12 && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP"
    };
    if (!ok) throw new ApiError(400, "Файл не похож на картинку");
    var name = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant() + "." + (kind == "jpeg" ? "jpg" : kind);
    await File.WriteAllBytesAsync(Path.Combine(uploadsDir, name), bytes);
    return Results.Json(new { url = "/uploads/" + name });
});

adm.MapGet("/orders", () => Results.Json(store.AllOrders()));
adm.MapMethods("/orders/{id:int}", ["PATCH"], async (HttpContext c, int id) => store.PatchOrder(id, await ReadJson(c, 8192)) is { } o ? Results.Json(o) : Err(404, "Заказ не найден"));

adm.MapGet("/settings", () => Results.Json(store.Settings));
adm.MapPut("/settings", async (HttpContext c) => Results.Json(store.SaveSettings(await ReadJson(c, 16 * 1024))));
adm.MapPost("/password", async (HttpContext c) =>
{
    var b = await ReadJson(c, 4096);
    if (!store.CheckPassword(V.Str(b["current"], 200))) return Err(401, "Текущий пароль неверный");
    var next = b["next"]?.GetValue<string>() ?? "";
    if (next.Length < 8) throw new ApiError(400, "Новый пароль — минимум 8 символов");
    store.SetPassword(next);
    sessions.Clear();
    return Results.Json(new { ok = true });
});

app.MapFallback("/api/{**rest}", () => Err(404, "Не найдено"));

// чистка старых сессий и счётчиков
_ = Task.Run(async () =>
{
    while (true)
    {
        await Task.Delay(TimeSpan.FromMinutes(10));
        foreach (var (k, v) in sessions) if (v < DateTime.UtcNow) sessions.TryRemove(k, out _);
        foreach (var (k, v) in hits) lock (v) if (v.All(t => DateTime.UtcNow - t > TimeSpan.FromHours(1))) hits.TryRemove(k, out _);
    }
});

Console.WriteLine($"Сайт: http://{host}:{port}   Админка: http://{host}:{port}{adminPath}");
if (adminIps.Length > 0) Console.WriteLine("Админка открывается только с IP: " + string.Join(", ", adminIps));
if (store.Admin == null) Console.WriteLine("⚠ Пароль админки не задан. Выполните: dotnet TileShop.Server.dll set-password");
if (tgToken == "") Console.WriteLine("ℹ Уведомления в Telegram выключены (задайте TG_BOT_TOKEN и TG_CHAT_ID).");
app.Run();
return 0;

// =====================================================================

/// Ошибка, которую видит пользователь (код + понятный текст).
public sealed class ApiError(int code, string message) : Exception(message) { public int Code { get; } = code; }

/// Числа из JSON — любого вида (int, long, decimal, double).
public static class JsonNum
{
    public static decimal Dec(this JsonNode? n)
    {
        if (n is not JsonValue v) return 0;
        if (v.TryGetValue<decimal>(out var d)) return d;
        if (v.TryGetValue<int>(out var i)) return i;
        if (v.TryGetValue<long>(out var l)) return l;
        if (v.TryGetValue<double>(out var f)) return (decimal)f;
        return 0;
    }
    public static int Int(this JsonNode? n) => (int)Dec(n);
}

/// Проверка входящих данных.
public static class V
{
    public static string Str(JsonNode? v, int max) =>
        v is JsonValue jv && jv.TryGetValue<string>(out var s) ? (s.Trim() is var t && t.Length > max ? t[..max] : t) : "";
    public static decimal? Num(JsonNode? v, decimal min, decimal max)
    {
        decimal d;
        if (v is JsonValue jv && (jv.TryGetValue(out d) || (jv.TryGetValue<string>(out var s) && decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out d))))
            return Math.Min(max, Math.Max(min, d));
        return null;
    }
    public static bool Bool(JsonNode? v) => v is JsonValue jv && jv.TryGetValue<bool>(out var b) && b;
    public static string? Phone(JsonNode? v)
    {
        var s = Regex.Replace(Str(v, 40), @"[\s()\-.]", "");
        return Regex.IsMatch(s, @"^\+[1-9]\d{7,14}$") ? s : null;
    }
}

/// Хранилище: JSON-файлы в data/, запись атомарная (через временный файл).
public sealed class Store
{
    readonly string _dir;
    readonly object _lock = new();
    static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    JsonArray _products, _orders, _push;
    public JsonObject Settings { get; private set; }
    public JsonObject? Admin { get; private set; }

    static readonly string[] Uses = ["wall", "floor", "plinth", "outdoor"];
    static readonly string[] Cats = ["bath", "kitchen", "floor", "universal", "outdoor"];
    static readonly string[] Styles = ["marble", "onyx", "stone", "concrete", "terrazzo", "solid"];
    static readonly string[] Materials = ["solid", "marble", "stone", "travertine", "slate", "wood", "terrazzo", "zellige", "brick", "mosaic", "pattern"];
    static readonly string[] Layouts = ["straight", "brick", "third", "diagonal", "herringbone"];
    static readonly string[] Statuses = ["new", "confirmed", "paid", "delivering", "done", "cancelled"];
    static readonly Regex Color = new("^#[0-9a-fA-F]{6}$");

    public Store(string dir, string publicDir)
    {
        _dir = dir;
        var seed = Path.Combine(publicDir, "shared", "data");
        _products = Load("products") as JsonArray ?? SeedProducts(Path.Combine(seed, "products.json"));
        _orders = Load("orders") as JsonArray ?? new JsonArray();
        _push = Load("push") as JsonArray ?? new JsonArray();
        Settings = Load("settings") as JsonObject ?? (JsonNode.Parse(File.ReadAllText(Path.Combine(seed, "shop.json"))) as JsonObject ?? new JsonObject());
        Admin = Load("admin") as JsonObject;
        Save("products", _products); Save("orders", _orders); Save("settings", Settings);
    }
    static JsonArray SeedProducts(string file)
    {
        var list = (JsonNode.Parse(File.ReadAllText(file))!["products"] as JsonArray)!.DeepClone().AsArray();
        var i = 0;
        foreach (var p in list) { p!["active"] = true; p["order"] = i++; }
        return list;
    }
    JsonNode? Load(string name)
    {
        try { return JsonNode.Parse(File.ReadAllText(Path.Combine(_dir, name + ".json"))); } catch { return null; }
    }
    void Save(string name, JsonNode value)
    {
        var file = Path.Combine(_dir, name + ".json");
        var tmp = file + "." + Environment.ProcessId + ".tmp";
        File.WriteAllText(tmp, value.ToJsonString(Pretty));
        File.Move(tmp, file, true);
    }
    static JsonNode Clone(JsonNode n) => n.DeepClone();

    // ---- пароль (PBKDF2-SHA256) ----
    public void SetPassword(string pw)
    {
        lock (_lock)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = Rfc2898DeriveBytes.Pbkdf2(pw, salt, 210_000, HashAlgorithmName.SHA256, 32);
            Admin = new JsonObject { ["algo"] = "pbkdf2-sha256", ["iter"] = 210_000, ["salt"] = Convert.ToHexString(salt), ["hash"] = Convert.ToHexString(hash) };
            Save("admin", Admin);
        }
    }
    public bool CheckPassword(string pw)
    {
        var a = Admin;
        if (a == null || pw == "") return false;
        var hash = Rfc2898DeriveBytes.Pbkdf2(pw, Convert.FromHexString(a["salt"]!.GetValue<string>()), a["iter"].Int(), HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(hash, Convert.FromHexString(a["hash"]!.GetValue<string>()));
    }

    // ---- товары ----
    static IEnumerable<JsonNode> Sorted(JsonArray a) => a.Where(x => x != null).OrderBy(x => x!["order"].Dec())!;
    public JsonArray PublicProducts() { lock (_lock) return new JsonArray(Sorted(_products).Where(p => p["active"]?.GetValue<bool>() != false).Select(Clone).ToArray()); }
    public JsonArray AllProducts() { lock (_lock) return new JsonArray(Sorted(_products).Select(Clone).ToArray()); }
    JsonObject? FindProduct(string id) => _products.FirstOrDefault(x => x?["id"]?.GetValue<string>() == id) as JsonObject;

    public JsonObject AddProduct(JsonObject b)
    {
        lock (_lock)
        {
            var p = Clean(b, null);
            p["id"] = "p" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString("x") + Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();
            p["order"] = (_products.Select(x => x?["order"].Dec()).DefaultIfEmpty(0).Min()) - 1; // новые — сверху
            _products.Add(p); Save("products", _products);
            return (JsonObject)Clone(p);
        }
    }
    public JsonObject? UpdateProduct(string id, JsonObject b)
    {
        lock (_lock)
        {
            var old = FindProduct(id); if (old == null) return null;
            var p = Clean(b, old); p["id"] = id;
            _products[_products.IndexOf(old)] = p; Save("products", _products);
            return (JsonObject)Clone(p);
        }
    }
    public JsonObject? PatchProduct(string id, JsonObject b)
    {
        lock (_lock)
        {
            var x = FindProduct(id); if (x == null) return null;
            if (b.ContainsKey("inStock")) x["inStock"] = V.Bool(b["inStock"]);
            if (b.ContainsKey("active")) x["active"] = V.Bool(b["active"]);
            if (b.ContainsKey("isNew")) x["isNew"] = V.Bool(b["isNew"]);
            if (b.ContainsKey("price") && V.Num(b["price"], 0, 1_000_000_000) is { } pr) x["price"] = pr;
            Save("products", _products);
            return (JsonObject)Clone(x);
        }
    }
    public bool DeleteProduct(string id)
    {
        lock (_lock)
        {
            var x = FindProduct(id); if (x == null) return false;
            _products.Remove(x); Save("products", _products);
            return true;
        }
    }

    static JsonObject Clean(JsonObject b, JsonObject? old)
    {
        var p = old != null ? (JsonObject)Clone(old) : new JsonObject();
        string Need(string v, string msg) => v != "" ? v : throw new ApiError(400, msg);
        p["name"] = Need(V.Str(b["name"], 80), "Укажите название");
        p["collection"] = V.Str(b["collection"], 60);
        p["country"] = V.Str(b["country"], 40);
        p["finish"] = V.Str(b["finish"], 60);
        p["w"] = V.Num(b["w"], 1, 300) ?? throw new ApiError(400, "Укажите размер плитки");
        p["h"] = V.Num(b["h"], 1, 300) ?? throw new ApiError(400, "Укажите размер плитки");
        p["price"] = V.Num(b["price"], 0, 1_000_000_000) ?? throw new ApiError(400, "Укажите цену");
        p["box"] = V.Num(b["box"], 0.01m, 100) is { } bx && bx > 0 ? bx : throw new ApiError(400, "Укажите м² в коробке");
        var use = (b["use"] as JsonArray)?.Select(x => V.Str(x, 20)).Where(Uses.Contains).Distinct().ToArray() ?? [];
        if (use.Length == 0) throw new ApiError(400, "Отметьте, где можно класть плитку");
        p["use"] = new JsonArray(use.Select(x => (JsonNode)x!).ToArray());
        var cats = (b["cats"] as JsonArray)?.Select(x => V.Str(x, 20)).Where(Cats.Contains).Distinct().ToArray() ?? [];
        p["cats"] = new JsonArray((cats.Length > 0 ? cats : ["universal"]).Select(x => (JsonNode)x!).ToArray());
        p["inStock"] = V.Bool(b["inStock"]);
        p["active"] = b["active"] is JsonValue av && av.TryGetValue<bool>(out var a) ? a : true;
        p["isNew"] = V.Bool(b["isNew"]);
        var style = V.Str(b["style"], 20);
        p["style"] = Styles.Contains(style) ? style : (p["style"]?.GetValue<string>() ?? "solid");
        p["createdAt"] ??= DateTime.UtcNow.ToString("o");
        var lay = V.Str(b["defaultLayout"], 20);
        if (Layouts.Contains(lay)) p["defaultLayout"] = lay; else p.Remove("defaultLayout");
        var img = V.Str(b["image"], 200);
        if (Regex.IsMatch(img, @"^/uploads/[a-f0-9]{24}\.(jpg|png|webp)$")) p["image"] = img; else p.Remove("image");
        if (b["material"] is JsonObject m)
        {
            var type = Materials.Contains(V.Str(m["type"], 20)) ? V.Str(m["type"], 20) : "solid";
            var c1 = Color.IsMatch(V.Str(m["c1"], 7)) ? V.Str(m["c1"], 7) : "#cccccc";
            var c2 = Color.IsMatch(V.Str(m["c2"], 7)) ? V.Str(m["c2"], 7) : "#888888";
            p["material"] = MaterialFrom(type, c1, c2, V.Num(m["gloss"], 0, 1) ?? 0);
        }
        else if (p["material"] == null) p["material"] = MaterialFrom("solid", "#cccccc", "#888888", 0.3m);
        return p;
    }
    // Два цвета из админки → параметры имитации плитки
    static JsonObject MaterialFrom(string type, string c1, string c2, decimal gloss)
    {
        var m = new JsonObject { ["type"] = type, ["gloss"] = gloss, ["c1"] = c1, ["c2"] = c2 };
        switch (type)
        {
            case "marble": m["base"] = c1; m["vein"] = c2; m["veinAlpha"] = 0.55; break;
            case "travertine": m["base"] = c1; m["line"] = c2; break;
            case "stone": case "slate": case "brick": m["base"] = c1; m["speck"] = 0.7; break;
            case "wood": m["base"] = c1; m["grain"] = c2; break;
            case "terrazzo": m["base"] = c1; m["chips"] = new JsonArray(c2, "#8a8d91", "#c9b9a6", "#4f5559"); break;
            case "mosaic": m["cells"] = 10; m["colors"] = new JsonArray(c1, c2, c1, c2, "#ffffff"); m["grout"] = "#e9eef0"; break;
            case "pattern": m["motif"] = "star"; m["bg"] = c1; m["fg"] = c2; m["accent"] = c2; break;
            default: m["color"] = c1; break;
        }
        return m;
    }

    // ---- заказы ----
    public JsonObject CreateOrder(JsonObject b)
    {
        var customer = new JsonObject { ["name"] = V.Str(b["customer"]?["name"], 80), ["phone"] = V.Phone(b["customer"]?["phone"]), ["contact"] = V.Str(b["customer"]?["contact"], 20) };
        var recipient = new JsonObject { ["name"] = V.Str(b["recipient"]?["name"], 80), ["phone"] = V.Phone(b["recipient"]?["phone"]) };
        var address = new JsonObject { ["city"] = V.Str(b["address"]?["city"], 80), ["street"] = V.Str(b["address"]?["street"], 200) };
        if (customer["name"]!.GetValue<string>() == "") throw new ApiError(400, "Укажите ваше имя");
        if (customer["phone"] == null) throw new ApiError(400, "Укажите ваш телефон с кодом страны, например +1 555 123 4567");
        if (recipient["name"]!.GetValue<string>() == "" || recipient["phone"] == null) throw new ApiError(400, "Укажите имя и телефон получателя");
        if (address["city"]!.GetValue<string>() == "" || address["street"]!.GetValue<string>() == "") throw new ApiError(400, "Укажите адрес доставки");
        lock (_lock)
        {
            var items = new JsonArray();
            foreach (var it in (b["items"] as JsonArray ?? []).Take(60))
            {
                var prod = FindProduct(V.Str(it?["id"], 100));
                var boxes = (int)Math.Round(V.Num(it?["boxes"], 0, 10000) ?? 0);
                if (prod == null || boxes == 0) continue;
                var box = prod["box"].Dec(); var price = prod["price"].Dec();
                var m2 = Math.Round(boxes * box, 2);
                items.Add(new JsonObject
                {
                    ["id"] = prod["id"]!.GetValue<string>(), ["name"] = prod["name"]!.GetValue<string>(),
                    ["size"] = $"{prod["w"]}×{prod["h"]}", ["boxes"] = boxes, ["m2"] = m2, ["price"] = price,
                    ["sum"] = Math.Round(m2 * price), ["note"] = V.Str(it?["note"], 120)
                });
            }
            if (items.Count == 0) throw new ApiError(400, "Корзина пуста");
            var order = new JsonObject
            {
                ["id"] = _orders.Select(o => o?["id"].Int()).DefaultIfEmpty(1000).Max() is var mx && mx < 1000 ? 1001 : mx + 1,
                ["createdAt"] = DateTime.UtcNow.ToString("o"), ["status"] = "new",
                ["customer"] = customer, ["recipient"] = recipient, ["address"] = address,
                ["comment"] = V.Str(b["comment"], 1000),
                ["links"] = new JsonArray((b["links"] as JsonArray ?? []).Take(10).Select(l => V.Str(l, 4000)).Where(l => Regex.IsMatch(l, "^https?://")).Select(l => (JsonNode)l!).ToArray()),
                ["items"] = items, ["total"] = items.Sum(i => i!["sum"].Dec()), ["adminNote"] = ""
            };
            _orders.Add(order); Save("orders", _orders);
            return (JsonObject)Clone(order);
        }
    }
    public JsonArray AllOrders() { lock (_lock) return new JsonArray(_orders.Reverse().Select(o => Clone(o!)).ToArray()); }
    public JsonObject? PatchOrder(int id, JsonObject b)
    {
        lock (_lock)
        {
            var o = _orders.FirstOrDefault(x => x?["id"].Int() == id) as JsonObject;
            if (o == null) return null;
            var st = V.Str(b["status"], 20);
            if (Statuses.Contains(st)) o["status"] = st;
            if (b["adminNote"] is JsonValue) o["adminNote"] = V.Str(b["adminNote"], 2000);
            Save("orders", _orders);
            return (JsonObject)Clone(o);
        }
    }

    // ---- настройки ----
    static readonly string[] PublicKeys = ["name", "tagline", "phone", "phoneRaw", "telegram", "address", "hours", "mapUrl", "currency", "reserve", "holdDays", "usdRate", "deliveryNote", "years", "clients"];
    public JsonObject PublicSettings() { lock (_lock) { var o = new JsonObject(); foreach (var k in PublicKeys) if (Settings[k] is { } v) o[k] = Clone(v); return o; } }
    public void UpdateSettings(Action<JsonObject> f) { lock (_lock) { f(Settings); Save("settings", Settings); } }
    public JsonObject SaveSettings(JsonObject b)
    {
        lock (_lock)
        {
            var s = Settings;
            foreach (var k in new[] { "name", "tagline", "phone", "telegram", "address", "hours", "mapUrl", "currency", "deliveryNote", "payCard", "payCardHolder", "payBank" })
                if (b.ContainsKey(k)) s[k] = V.Str(b[k], 500);
            if (b.ContainsKey("phoneRaw")) s["phoneRaw"] = Regex.Replace(V.Str(b["phoneRaw"], 20), @"\D", "");
            if (V.Num(b["usdRate"], 0, 10_000_000) is { } r) s["usdRate"] = r;
            if (V.Num(b["holdDays"], 0, 60) is { } hd) s["holdDays"] = (int)hd;
            if (V.Num(b["years"], 0, 200) is { } y) s["years"] = (int)y;
            if (V.Num(b["clients"], 0, 1_000_000_000) is { } cl) s["clients"] = (int)cl;
            if (s["mapUrl"]?.GetValue<string>() is { } mu && mu != "" && !Regex.IsMatch(mu, "^https?://")) s["mapUrl"] = "";
            s["telegram"] = Regex.Replace((s["telegram"]?.GetValue<string>() ?? "").TrimStart('@'), @"[^\w]", "");
            Save("settings", s);
            return (JsonObject)Clone(s);
        }
    }

    // ---- push-подписки ----
    public List<JsonNode> PushSubs() { lock (_lock) return _push.Where(x => x != null).Select(x => Clone(x!)).ToList(); }
    public int AddPush(JsonObject sub)
    {
        lock (_lock)
        {
            var ep = sub["endpoint"]!.GetValue<string>();
            foreach (var old in _push.Where(x => x?["endpoint"]?.GetValue<string>() == ep).ToList()) _push.Remove(old);
            _push.Add(sub); Save("push", _push);
            return _push.Count;
        }
    }
    public void RemovePush(IEnumerable<string> endpoints)
    {
        var set = endpoints.ToHashSet(); if (set.Count == 0) return;
        lock (_lock)
        {
            foreach (var x in _push.Where(x => set.Contains(x?["endpoint"]?.GetValue<string>() ?? "")).ToList()) _push.Remove(x);
            Save("push", _push);
        }
    }
}
