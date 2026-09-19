use rusqlite::{params, Connection};
use serde_json::Value;
pub fn schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recovery (id INTEGER PRIMARY KEY, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, data TEXT NOT NULL);").map_err(|e|e.to_string())
}
pub fn check(data: &Value) -> Result<String, String> {
    if data["schema"] != 1
        || !data["habits"].is_array()
        || !data["goals"].is_array()
        || !data["records"].is_object()
        || !data["journals"].is_object()
        || !data["widgets"].is_array()
    {
        return Err("El archivo no es una copia de Forja compatible.".into());
    }
    let text = serde_json::to_string(data).map_err(|e| e.to_string())?;
    if text.len() > 20_000_000 {
        return Err("La copia supera el límite de 20 MB.".into());
    }
    Ok(text)
}
pub fn persist(conn: &mut Connection, data: &Value, backup: bool) -> Result<(), String> {
    let text = check(data)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if backup {
        tx.execute(
            "INSERT INTO recovery (data) SELECT data FROM state WHERE id=1",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "INSERT INTO state(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        params![text],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM recovery WHERE id NOT IN (SELECT id FROM recovery ORDER BY id DESC LIMIT 30)",
        [],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
