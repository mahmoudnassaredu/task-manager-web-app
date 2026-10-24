
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = 3000;

app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "taskdb",
    user: process.env.DB_USER || "appuser",
    password: process.env.DB_PASSWORD
});

// Test the API
app.get("/", (req, res) => {
    res.send("Task Manager API is running!");
});

// Get all tasks
app.get("/api/tasks", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tasks ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Failed to fetch tasks:", error.message);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});

// Add a task
app.post("/api/tasks", async (req, res) => {
    const { title } = req.body;

    if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
            error: "A task title is required"
        });
    }

    try {
        const result = await pool.query(
            "INSERT INTO tasks (title) VALUES ($1) RETURNING *",
            [title.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Failed to create task:", error.message);
        res.status(500).json({ error: "Failed to create task" });
    }
});

// Mark a task as completed
app.patch("/api/tasks/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid task ID" });
    }

    try {
        const result = await pool.query(
            "UPDATE tasks SET completed = TRUE WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Failed to update task:", error.message);
        res.status(500).json({ error: "Failed to update task" });
    }
});

const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Task Manager API listening on port ${port}`);
});

// Close connections cleanly when the container stops
async function shutdown() {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

