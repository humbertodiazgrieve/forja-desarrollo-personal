#[path = "../src/database.rs"]
mod database;
use database::*;
use rusqlite::Connection;
use serde_json::{json, Value};
#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> Value {
        json!({"schema":1,"habits":[],"goals":[],"records":{},"journals":{},"widgets":[]})
    }
    #[test]
    fn atomic_save_and_restore_backup() {
        let mut c = Connection::open_in_memory().unwrap();
        schema(&c).unwrap();
        let a = sample();
        persist(&mut c, &a, false).unwrap();
        let mut b = a.clone();
        b["records"] = json!({"2026-09-14":{"water":3}});
        persist(&mut c, &b, true).unwrap();
        let old: String = c
            .query_row("SELECT data FROM recovery", [], |r| r.get(0))
            .unwrap();
        assert_eq!(serde_json::from_str::<Value>(&old).unwrap(), a);
        let current: String = c
            .query_row("SELECT data FROM state", [], |r| r.get(0))
            .unwrap();
        assert_eq!(serde_json::from_str::<Value>(&current).unwrap(), b);
    }
    #[test]
    fn invalid_restore_does_not_replace() {
        let mut c = Connection::open_in_memory().unwrap();
        schema(&c).unwrap();
        persist(&mut c, &sample(), false).unwrap();
        assert!(persist(&mut c, &json!({"schema":99}), true).is_err());
        let n: i64 = c
            .query_row("SELECT count(*) FROM state", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }
}
