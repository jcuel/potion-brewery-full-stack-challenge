using Microsoft.Data.Sqlite;
using PotionBrewery.Models;

namespace PotionBrewery.Api;

public static class AlchemistEndpoints
{
    public static void MapAlchemistEndpoints(this WebApplication app)
    {
        app.MapGet("/api/alchemists", (SqliteConnection db) =>
        {
            var alchemists = new List<object>();
            using var cmd = db.CreateCommand();
            cmd.CommandText = "SELECT name, profile_image FROM alchemist_profiles ORDER BY id";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                alchemists.Add(new
                {
                    name = reader.GetString(0),
                    profile_image = reader.IsDBNull(1) ? null : reader.GetString(1)
                });
            }
            return Results.Ok(alchemists);
        });

        app.MapGet("/api/alchemist/{name}", (string name, SqliteConnection db) =>
        {
            using var cmd = db.CreateCommand();
            cmd.CommandText = "SELECT id, name, service_start_date, profile_image FROM alchemist_profiles WHERE name = @name";
            cmd.Parameters.AddWithValue("@name", name);
            using var reader = cmd.ExecuteReader();

            if (!reader.Read())
            {
                return Results.NotFound(new { error = $"Alchemist '{name}' not found" });
            }

            var profile = new AlchemistProfile
            {
                Id = reader.GetInt32(0),
                Name = reader.GetString(1),
                ServiceStartDate = reader.GetString(2),
                ProfileImage = reader.IsDBNull(3) ? null : reader.GetString(3)
            };

            reader.Close();

            using var countCmd = db.CreateCommand();
            countCmd.CommandText = "SELECT COUNT(*) FROM potion_orders WHERE assigned_alchemist = @name AND status = 'Ready for Pickup'";
            countCmd.Parameters.AddWithValue("@name", name);
            profile.PotionsCompleted = Convert.ToInt32(countCmd.ExecuteScalar());

            return Results.Ok(new
            {
                id = profile.Id,
                name = profile.Name,
                service_start_date = profile.ServiceStartDate,
                profile_image = profile.ProfileImage,
                potions_completed = profile.PotionsCompleted
            });
        });

        app.MapPost("/api/alchemist", (AlchemistProfileCreate input, SqliteConnection db) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name))
            {
                return Results.BadRequest(new { error = "Name is required" });
            }

            var serviceStartDate = input.ServiceStartDate ?? DateTime.UtcNow.ToString("yyyy-MM-dd");

            using var cmd = db.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO alchemist_profiles (name, service_start_date)
                VALUES (@name, @service_start_date)
                RETURNING id, name, service_start_date, profile_image";
            cmd.Parameters.AddWithValue("@name", input.Name);
            cmd.Parameters.AddWithValue("@service_start_date", serviceStartDate);

            try
            {
                using var reader = cmd.ExecuteReader();
                if (reader.Read())
                {
                    return Results.Created($"/api/alchemist/{input.Name}", new
                    {
                        id = reader.GetInt32(0),
                        name = reader.GetString(1),
                        service_start_date = reader.GetString(2),
                        profile_image = reader.IsDBNull(3) ? null : reader.GetString(3)
                    });
                }
                return Results.StatusCode(500);
            }
            catch (SqliteException ex) when (ex.SqliteErrorCode == 19)
            {
                return Results.Conflict(new { error = $"Alchemist '{input.Name}' already exists" });
            }
        });

        app.MapPut("/api/alchemist/{name}", (string name, AlchemistProfileUpdate input, SqliteConnection db) =>
        {
            var setClauses = new List<string>();
            var parameters = new List<SqliteParameter>();

            if (input.ServiceStartDate is not null)
            {
                setClauses.Add("service_start_date = @service_start_date");
                parameters.Add(new SqliteParameter("@service_start_date", input.ServiceStartDate));
            }

            if (input.ProfileImage is not null)
            {
                setClauses.Add("profile_image = @profile_image");
                parameters.Add(new SqliteParameter("@profile_image", input.ProfileImage));
            }

            if (setClauses.Count == 0)
            {
                return Results.BadRequest(new { error = "No fields to update" });
            }

            using var cmd = db.CreateCommand();
            cmd.CommandText = $@"
                UPDATE alchemist_profiles
                SET {string.Join(", ", setClauses)}
                WHERE name = @name
                RETURNING id, name, service_start_date, profile_image";
            cmd.Parameters.AddWithValue("@name", name);
            foreach (var param in parameters) cmd.Parameters.Add(param);

            using var reader = cmd.ExecuteReader();
            if (!reader.Read())
            {
                return Results.NotFound(new { error = $"Alchemist '{name}' not found" });
            }

            var result = new
            {
                id = reader.GetInt32(0),
                name = reader.GetString(1),
                service_start_date = reader.GetString(2),
                profile_image = reader.IsDBNull(3) ? null : reader.GetString(3),
                potions_completed = 0
            };

            reader.Close();

            using var countCmd = db.CreateCommand();
            countCmd.CommandText = "SELECT COUNT(*) FROM potion_orders WHERE assigned_alchemist = @name AND status = 'Ready for Pickup'";
            countCmd.Parameters.AddWithValue("@name", name);
            var count = Convert.ToInt32(countCmd.ExecuteScalar());

            return Results.Ok(new
            {
                result.id,
                result.name,
                result.service_start_date,
                result.profile_image,
                potions_completed = count
            });
        });
    }
}
