using Microsoft.Data.Sqlite;

namespace PotionBrewery.Database;

public static class DbInit
{
    public static void Initialize(SqliteConnection connection)
    {
        CreateTables(connection);
        SeedAlchemists(connection);
        SeedPotionOrders(connection);
    }

    private static void CreateTables(SqliteConnection connection)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS alchemist_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                service_start_date TEXT NOT NULL,
                profile_image TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS potion_orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                location TEXT NOT NULL,
                potion TEXT NOT NULL,
                assigned_alchemist TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'To Do',
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        ";
        cmd.ExecuteNonQuery();
    }

    private static void SeedAlchemists(SqliteConnection connection)
    {
        var alchemists = new (string Name, int YearsAgo, string ImageFile)[]
        {
            ("Bramblewood Fizzwick", 127, "Bramblewood.png"),
            ("Thistle Moonwhisper", 43, "Thistle.png"),
            ("Sage Emberstone", 15, "Sage.png")
        };

        foreach (var (name, yearsAgo, imageFile) in alchemists)
        {
            var serviceStartDate = DateTime.UtcNow.AddYears(-yearsAgo).ToString("yyyy-MM-dd");
            string? profileImage = LoadImageAsBase64(imageFile);

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO alchemist_profiles (name, service_start_date, profile_image)
                VALUES (@name, @service_start_date, @profile_image)";
            cmd.Parameters.AddWithValue("@name", name);
            cmd.Parameters.AddWithValue("@service_start_date", serviceStartDate);
            cmd.Parameters.AddWithValue("@profile_image", (object?)profileImage ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }
    }

    private static string? LoadImageAsBase64(string filename)
    {
        var imagePath = System.IO.Path.Combine("..", "images", filename);
        if (!File.Exists(imagePath))
        {
            Console.WriteLine($"Warning: Image not found at {System.IO.Path.GetFullPath(imagePath)}");
            return null;
        }

        var bytes = File.ReadAllBytes(imagePath);
        var base64 = Convert.ToBase64String(bytes);
        var extension = System.IO.Path.GetExtension(filename).TrimStart('.').ToLowerInvariant();
        var mimeType = extension switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/jpeg"
        };
        return $"data:{mimeType};base64,{base64}";
    }

    private static void SeedPotionOrders(SqliteConnection connection)
    {
        var sampleOrders = new (string Id, string Customer, string Location, string Potion, string Alchemist, string Status, string Notes)[]
        {
            ("1", "Elena Vasquez", "Barcelona, Spain", "Essence of Invisibility", "Thistle Moonwhisper", "To Do",
                "Last time the Invisibility Potion only made my left arm disappear. Please do better."),
            ("2", "Marcus Chen", "San Francisco, USA", "Dragonfire Breath Tonic", "Sage Emberstone", "Brewing",
                "Need this for a talent show next week. Extra spicy please."),
            ("4", "Oliver Smith", "London, UK", "Elixir of Eloquence", "Bramblewood Fizzwick", "Ready for Pickup",
                "For my dissertation defense. The examiners are brutal."),
            ("5", "Aisha Patel", "Mumbai, India", "Nightshade Sleep Draught", "Thistle Moonwhisper", "To Do",
                "Strong enough to knock out a grown elephant, please. My neighbor plays drums at midnight."),
            ("6", "Lucas Dubois", "Paris, France", "Bottled Starlight", "Sage Emberstone", "Brewing",
                "For a very romantic dinner. It needs to literally glow. No pressure.")
        };

        foreach (var order in sampleOrders)
        {
            InsertOrder(connection, order.Id, order.Customer, order.Location, order.Potion, order.Alchemist, order.Status, order.Notes);
        }

        var random = new Random(42);
        for (int i = 0; i < SampleData.ElixirCount; i++)
        {
            var id = (7 + i).ToString();
            var firstName = SampleData.SampleFirstNames[random.Next(SampleData.SampleFirstNames.Length)];
            var lastName = SampleData.SampleLastNames[random.Next(SampleData.SampleLastNames.Length)];
            var customerName = $"{firstName} {lastName}";
            var location = SampleData.SampleLocations[random.Next(SampleData.SampleLocations.Length)];
            var potion = SampleData.ElixirTypes[random.Next(SampleData.ElixirTypes.Length)];
            var notes = GenerateNote(random);

            InsertOrder(connection, id, customerName, location, potion, "Bramblewood Fizzwick", "Quality Control", notes);
        }
    }

    private static string GenerateNote(Random random)
    {
        var greeting = SampleData.NoteGreetings[random.Next(SampleData.NoteGreetings.Length)];
        var request = SampleData.NoteRequests[random.Next(SampleData.NoteRequests.Length)];
        var reason = SampleData.NoteReasons[random.Next(SampleData.NoteReasons.Length)];
        var extra = SampleData.NoteExtras[random.Next(SampleData.NoteExtras.Length)];
        var closing = SampleData.NoteClosings[random.Next(SampleData.NoteClosings.Length)];
        return $"{greeting} {request} {reason} {extra} {closing}";
    }

    private static void InsertOrder(SqliteConnection connection, string id, string customer, string location,
        string potion, string alchemist, string status, string notes)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes)
            VALUES (@id, @customer_name, @location, @potion, @assigned_alchemist, @status, @notes)";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@customer_name", customer);
        cmd.Parameters.AddWithValue("@location", location);
        cmd.Parameters.AddWithValue("@potion", potion);
        cmd.Parameters.AddWithValue("@assigned_alchemist", alchemist);
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@notes", notes);
        cmd.ExecuteNonQuery();
    }
}
