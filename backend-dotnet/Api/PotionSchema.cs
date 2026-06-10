using Microsoft.Data.Sqlite;
using PotionBrewery.Models;

namespace PotionBrewery.Api;


public class PotionOrderFilterInput
{
    [GraphQLName("status")]
    public string? Status { get; set; }

    [GraphQLName("assigned_alchemist")]
    public string? AssignedAlchemist { get; set; }
}

public class PotionOrderInput
{
    [GraphQLName("customer_name")]
    public string CustomerName { get; set; } = "";

    [GraphQLName("location")]
    public string Location { get; set; } = "";

    [GraphQLName("potion")]
    public string Potion { get; set; } = "";

    [GraphQLName("assigned_alchemist")]
    public string AssignedAlchemist { get; set; } = "";

    [GraphQLName("notes")]
    public string? Notes { get; set; }
}


[GraphQLName("PotionOrder")]
public class PotionOrderType
{
    [GraphQLName("id")]
    public string Id { get; set; } = "";

    [GraphQLName("customer_name")]
    public string CustomerName { get; set; } = "";

    [GraphQLName("location")]
    public string Location { get; set; } = "";

    [GraphQLName("potion")]
    public string Potion { get; set; } = "";

    [GraphQLName("assigned_alchemist")]
    public string AssignedAlchemist { get; set; } = "";

    [GraphQLName("status")]
    public string Status { get; set; } = "";

    [GraphQLName("notes")]
    public string? Notes { get; set; }
}


public class PotionQuery
{
    [GraphQLName("potionOrders")]
    public List<PotionOrderType> GetPotionOrders(
        SqliteConnection db,
        PotionOrderFilterInput? filter = null)
    {
        using var cmd = db.CreateCommand();
        var whereClauses = new List<string>();

        if (filter?.Status is not null)
        {
            whereClauses.Add("status = @status");
            cmd.Parameters.AddWithValue("@status", filter.Status);
        }

        if (filter?.AssignedAlchemist is not null)
        {
            whereClauses.Add("assigned_alchemist = @assigned_alchemist");
            cmd.Parameters.AddWithValue("@assigned_alchemist", filter.AssignedAlchemist);
        }

        var whereClause = whereClauses.Count > 0
            ? "WHERE " + string.Join(" AND ", whereClauses)
            : "";

        cmd.CommandText = $"SELECT id, customer_name, location, potion, assigned_alchemist, status, notes FROM potion_orders {whereClause} ORDER BY id";

        using var reader = cmd.ExecuteReader();
        var orders = new List<PotionOrderType>();
        while (reader.Read())
        {
            orders.Add(ReadOrder(reader));
        }
        return orders;
    }

    [GraphQLName("potionOrder")]
    public PotionOrderType? GetPotionOrder(SqliteConnection db, [GraphQLType("ID!")] string id)
    {
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id, customer_name, location, potion, assigned_alchemist, status, notes FROM potion_orders WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);

        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadOrder(reader) : null;
    }

    private static PotionOrderType ReadOrder(SqliteDataReader reader) => new()
    {
        Id = reader.GetString(0),
        CustomerName = reader.GetString(1),
        Location = reader.GetString(2),
        Potion = reader.GetString(3),
        AssignedAlchemist = reader.GetString(4),
        Status = reader.GetString(5),
        Notes = reader.IsDBNull(6) ? null : reader.GetString(6)
    };
}


public class PotionMutation
{
    [GraphQLName("addPotionOrder")]
    public PotionOrderType AddPotionOrder(SqliteConnection db, PotionOrderInput input)
    {
        var id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();

        using var cmd = db.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes)
            VALUES (@id, @customer_name, @location, @potion, @assigned_alchemist, 'To Do', @notes)
            RETURNING id, customer_name, location, potion, assigned_alchemist, status, notes";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@customer_name", input.CustomerName);
        cmd.Parameters.AddWithValue("@location", input.Location);
        cmd.Parameters.AddWithValue("@potion", input.Potion);
        cmd.Parameters.AddWithValue("@assigned_alchemist", input.AssignedAlchemist);
        cmd.Parameters.AddWithValue("@notes", (object?)input.Notes ?? DBNull.Value);

        using var reader = cmd.ExecuteReader();
        reader.Read();
        return new PotionOrderType
        {
            Id = reader.GetString(0),
            CustomerName = reader.GetString(1),
            Location = reader.GetString(2),
            Potion = reader.GetString(3),
            AssignedAlchemist = reader.GetString(4),
            Status = reader.GetString(5),
            Notes = reader.IsDBNull(6) ? null : reader.GetString(6)
        };
    }

    [GraphQLName("updatePotionOrderStatus")]
    public PotionOrderType? UpdatePotionOrderStatus(SqliteConnection db, [GraphQLType("ID!")] string id, string status)
    {
        if (!Constants.ValidStatuses.Contains(status))
        {
            throw new GraphQLException($"Invalid status: '{status}'. Valid statuses: {string.Join(", ", Constants.ValidStatuses)}");
        }

        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id, customer_name, location, potion, assigned_alchemist, status, notes FROM potion_orders WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        return new PotionOrderType
        {
            Id = reader.GetString(0),
            CustomerName = reader.GetString(1),
            Location = reader.GetString(2),
            Potion = reader.GetString(3),
            AssignedAlchemist = reader.GetString(4),
            Status = reader.GetString(5),
            Notes = reader.IsDBNull(6) ? null : reader.GetString(6)
        };
    }

    [GraphQLName("updatePotionOrderAlchemist")]
    public PotionOrderType? UpdatePotionOrderAlchemist(
        SqliteConnection db,
        [GraphQLType("ID!")] string id,
        [GraphQLName("assigned_alchemist")] string assignedAlchemist)
    {
        using var cmd = db.CreateCommand();
        cmd.CommandText = @"
            UPDATE potion_orders
            SET assigned_alchemist = @assigned_alchemist
            WHERE id = @id
            RETURNING id, customer_name, location, potion, assigned_alchemist, status, notes";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@assigned_alchemist", assignedAlchemist);

        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;

        return new PotionOrderType
        {
            Id = reader.GetString(0),
            CustomerName = reader.GetString(1),
            Location = reader.GetString(2),
            Potion = reader.GetString(3),
            AssignedAlchemist = reader.GetString(4),
            Status = reader.GetString(5),
            Notes = reader.IsDBNull(6) ? null : reader.GetString(6)
        };
    }
}
