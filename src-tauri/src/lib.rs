use chrono::{NaiveDate, NaiveDateTime};
use pgvector::Vector;
use rustls::SignatureScheme;
use serde_json::Value;
use std::str::FromStr;
use std::sync::Arc;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tokio_postgres::types::{ToSql, Type};
use tokio_postgres::Row;
use tokio_postgres_rustls::MakeRustlsConnect;
use uuid::Uuid;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            list_schemas,
            list_tables_by_schema,
            get_table_data,
            get_table_columns,
            get_primary_keys,
            update_rows,
            get_table_column_types
        ])
        .setup(|app| {
            if app.get_webview_window("main").is_some() {
                return Ok(());
            }
            let _window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Postgres Editor")
                .inner_size(800.0, 600.0)
                .build()
                .unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Debug)]
struct NoVerification;

impl rustls::client::danger::ServerCertVerifier for NoVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::ED25519,
            SignatureScheme::ED448,
        ]
    }
}

#[derive(serde::Serialize, Debug)]
pub struct Table {
    pub schema: String,
    pub name: String,
}

#[derive(serde::Serialize, Debug)]
pub struct TableData {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<Value>>,
}

#[derive(serde::Serialize, Debug)]
pub struct ColumnInfo {
    pub name: String,
    pub pg_type: String,
    pub is_nullable: bool,
}

#[derive(serde::Deserialize, Debug)]
pub struct Filter {
    column: String,
    operator: String,
    value: String,
}

#[derive(serde::Deserialize, Debug)]
pub struct Sort {
    column: String,
    direction: String,
}

#[derive(serde::Deserialize, Debug)]
struct UpdateRow {
    pks: serde_json::Value,
    changes: serde_json::Value,
}

fn to_sql_value(value: &Value, pg_type_name: &str) -> Result<Box<dyn ToSql + Send + Sync>, String> {
    if value.is_null() {
        return Ok(Box::new(None::<i32>));
    }

    if pg_type_name == "bool" {
        return match value.as_bool() {
            Some(b) => Ok(Box::new(b)),
            None => Err("expected boolean for bool type".to_string()),
        };
    }

    if let Some(s) = value.as_str() {
        if s.is_empty() {
            return Ok(Box::new(None::<String>));
        }

        match pg_type_name {
            "timestamp" | "timestamptz" => {
                let parsed = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M")
                    .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
                    .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f"))
                    .map_err(|e| format!("invalid timestamp format: {}", e))?;
                Ok(Box::new(parsed))
            }
            "date" => {
                let parsed = NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .map_err(|e| format!("invalid date format: {}", e))?;
                Ok(Box::new(parsed))
            }
            "uuid" => {
                let parsed =
                    Uuid::parse_str(s).map_err(|e| format!("invalid uuid format: {}", e))?;
                Ok(Box::new(parsed))
            }
            "int2" | "int4" | "int8" => s
                .parse::<i64>()
                .map(|v| Box::new(v) as Box<dyn ToSql + Send + Sync>)
                .map_err(|e| format!("invalid integer format: {}", e)),
            "float4" | "float8" => s
                .parse::<f64>()
                .map(|v| Box::new(v) as Box<dyn ToSql + Send + Sync>)
                .map_err(|e| format!("invalid float format: {}", e)),
            _ => Ok(Box::new(s.to_string())),
        }
    } else if let Some(n) = value.as_i64() {
        Ok(Box::new(n))
    } else if let Some(f) = value.as_f64() {
        Ok(Box::new(f))
    } else if let Some(b) = value.as_bool() {
        Ok(Box::new(b))
    } else {
        Err(format!("unsupported value type for: {:?}", value))
    }
}

#[tauri::command]
async fn get_primary_keys(uri: &str, schema: &str, table: &str) -> Result<Vec<String>, String> {
    let config = tokio_postgres::Config::from_str(uri).map_err(|e| e.to_string())?;

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = config.connect(tls).await.map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let query = "
        SELECT kcu.column_name
        FROM information_schema.key_column_usage AS kcu
        JOIN information_schema.table_constraints AS tc
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND kcu.table_schema = $1
        AND kcu.table_name = $2;
    ";

    let rows = client
        .query(query, &[&schema, &table])
        .await
        .map_err(|e| e.to_string())?;

    let pks = rows.iter().map(|row| row.get("column_name")).collect();

    Ok(pks)
}

#[tauri::command]
async fn update_rows(
    uri: &str,
    schema: &str,
    table: &str,
    changes: Vec<UpdateRow>,
) -> Result<(), String> {
    let config = tokio_postgres::Config::from_str(uri).map_err(|e| e.to_string())?;
    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);
    let (mut client, connection) = config.connect(tls).await.map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let column_type_tuples = get_table_column_types(uri, schema, table).await?;
    let column_types: std::collections::HashMap<String, String> =
        column_type_tuples.into_iter().collect();

    let transaction = client.transaction().await.map_err(|e| e.to_string())?;

    for change in changes {
        let pks = if let Some(obj) = change.pks.as_object() {
            obj
        } else {
            return Err("pks is not an object".to_string());
        };

        let updates = if let Some(obj) = change.changes.as_object() {
            obj
        } else {
            return Err("changes is not an object".to_string());
        };

        if updates.is_empty() {
            continue;
        }

        let mut set_clauses = Vec::new();
        let mut where_clauses = Vec::new();
        let mut params: Vec<Box<dyn ToSql + Send + Sync>> = Vec::new();
        let mut param_count = 1;

        for (key, value) in updates.iter() {
            set_clauses.push(format!("\"{}\" = ${}", key, param_count));
            let col_type = column_types
                .get(key)
                .ok_or_else(|| format!("column type not found for {}", key))?;
            params.push(to_sql_value(value, col_type)?);
            param_count += 1;
        }

        for (key, value) in pks.iter() {
            where_clauses.push(format!("\"{}\" = ${}", key, param_count));
            let col_type = column_types
                .get(key)
                .ok_or_else(|| format!("column type not found for {}", key))?;
            params.push(to_sql_value(value, col_type)?);
            param_count += 1;
        }

        let query = format!(
            "UPDATE \"{}\".\"{}\" SET {} WHERE {}",
            schema,
            table,
            set_clauses.join(", "),
            where_clauses.join(" AND ")
        );

        let mut params_slice: Vec<&(dyn ToSql + Sync)> = Vec::with_capacity(params.len());
        for p in &params {
            params_slice.push(p.as_ref());
        }

        transaction
            .execute(query.as_str(), &params_slice)
            .await
            .map_err(|e| e.to_string())?;
    }

    transaction.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn list_schemas(uri: &str) -> Result<Vec<String>, String> {
    let config = match tokio_postgres::Config::from_str(uri) {
        Ok(config) => config,
        Err(e) => return Err(e.to_string()),
    };

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = match config.connect(tls).await {
        Ok((client, connection)) => (client, connection),
        Err(e) => return Err(e.to_string()),
    };

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let rows = match client
        .query(
            "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp_%';",
            &[],
        )
        .await
    {
        Ok(rows) => rows,
        Err(e) => return Err(e.to_string()),
    };

    let mut schemas = Vec::new();
    for row in rows {
        schemas.push(row.get("nspname"));
    }

    Ok(schemas)
}

#[tauri::command]
async fn list_tables_by_schema(uri: &str, schema: &str) -> Result<Vec<String>, String> {
    let config = match tokio_postgres::Config::from_str(uri) {
        Ok(config) => config,
        Err(e) => return Err(e.to_string()),
    };

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = match config.connect(tls).await {
        Ok((client, connection)) => (client, connection),
        Err(e) => return Err(e.to_string()),
    };

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let rows = match client
        .query(
            "SELECT relname as name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = $1;",
            &[&schema],
        )
        .await
    {
        Ok(rows) => rows,
        Err(e) => return Err(e.to_string()),
    };

    let mut tables = Vec::new();
    for row in rows {
        tables.push(row.get("name"));
    }

    Ok(tables)
}

#[tauri::command]
async fn get_table_columns(uri: &str, schema: &str, table: &str) -> Result<Vec<String>, String> {
    let config = match tokio_postgres::Config::from_str(uri) {
        Ok(config) => config,
        Err(e) => return Err(e.to_string()),
    };

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = match config.connect(tls).await {
        Ok((client, connection)) => (client, connection),
        Err(e) => return Err(e.to_string()),
    };

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let rows = match client
        .query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
            &[&schema, &table],
        )
        .await
    {
        Ok(rows) => rows,
        Err(e) => return Err(e.to_string()),
    };

    let mut columns = Vec::new();
    for row in rows {
        columns.push(row.get("column_name"));
    }

    Ok(columns)
}

#[tauri::command]
async fn get_table_data(
    uri: &str,
    schema: &str,
    table: &str,
    limit: i64,
    offset: i64,
    filters: Option<Vec<Filter>>,
    logical_operator: Option<String>,
    sorts: Option<Vec<Sort>>,
) -> Result<TableData, String> {
    let config = match tokio_postgres::Config::from_str(uri) {
        Ok(config) => config,
        Err(e) => return Err(e.to_string())?,
    };

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = match config.connect(tls).await {
        Ok((client, connection)) => (client, connection),
        Err(e) => return Err(e.to_string())?,
    };

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let column_query = "SELECT column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position";
    let column_rows = client
        .query(column_query, &[&schema, &table])
        .await
        .map_err(|e| e.to_string())?;

    let columns: Vec<ColumnInfo> = column_rows
        .iter()
        .map(|row| {
            let is_nullable_str: &str = row.get("is_nullable");
            ColumnInfo {
                name: row.get("column_name"),
                pg_type: row.get("udt_name"),
                is_nullable: is_nullable_str == "YES",
            }
        })
        .collect();

    let mut params: Vec<Box<dyn ToSql + Send + Sync>> = Vec::new();
    let mut param_id = 1;

    let where_clause = if let Some(filters) = filters {
        if !filters.is_empty() {
            let operator = logical_operator.unwrap_or_else(|| "AND".to_string());
            let conditions: Vec<String> = filters
                .iter()
                .map(|f| {
                    let condition = format!("\"{}\" {} ${}", f.column, f.operator, param_id);
                    params.push(Box::new(f.value.clone()));
                    param_id += 1;
                    condition
                })
                .collect();
            format!("WHERE {}", conditions.join(&format!(" {} ", operator)))
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let order_by_clause = if let Some(sorts) = sorts {
        if !sorts.is_empty() {
            let sort_conditions: Vec<String> = sorts
                .iter()
                .filter_map(|s| {
                    let direction = s.direction.to_uppercase();
                    if direction == "ASC" || direction == "DESC" {
                        Some(format!("\"{}\" {}", s.column, direction))
                    } else {
                        None
                    }
                })
                .collect();
            if !sort_conditions.is_empty() {
                format!("ORDER BY {}", sort_conditions.join(", "))
            } else {
                "".to_string()
            }
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let query = format!(
        "SELECT * FROM \"{}\".\"{}\" {} {} LIMIT ${} OFFSET ${}",
        schema,
        table,
        where_clause,
        order_by_clause,
        param_id,
        param_id + 1
    );

    let mut query_params: Vec<&(dyn ToSql + Sync)> = Vec::with_capacity(params.len() + 2);
    for p in &params {
        query_params.push(p.as_ref());
    }
    query_params.push(&limit);
    query_params.push(&offset);

    let rows = client
        .query(query.as_str(), &query_params)
        .await
        .map_err(|e| e.to_string())?;

    let data = rows
        .iter()
        .map(|row| {
            row.columns()
                .iter()
                .enumerate()
                .map(|(i, col)| cell_to_json(row, col.type_(), i))
                .collect()
        })
        .collect();

    Ok(TableData {
        columns,
        rows: data,
    })
}

#[tauri::command]
async fn get_table_column_types(
    uri: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<(String, String)>, String> {
    let config = tokio_postgres::Config::from_str(uri).map_err(|e| e.to_string())?;

    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerification))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let (client, connection) = config.connect(tls).await.map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    let query = "
        SELECT column_name, udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
    ";

    let rows = client
        .query(query, &[&schema, &table])
        .await
        .map_err(|e| e.to_string())?;

    let types = rows
        .iter()
        .map(|row| (row.get("column_name"), row.get("udt_name")))
        .collect();

    Ok(types)
}

#[tauri::command]
fn cell_to_json(row: &Row, col_type: &Type, idx: usize) -> Value {
    match *col_type {
        Type::BOOL => row
            .try_get::<_, Option<bool>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::INT2 => row
            .try_get::<_, Option<i16>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::INT4 => row
            .try_get::<_, Option<i32>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::INT8 => row
            .try_get::<_, Option<i64>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::FLOAT4 => row
            .try_get::<_, Option<f32>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::FLOAT8 => row
            .try_get::<_, Option<f64>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::TEXT | Type::VARCHAR | Type::NAME => row
            .try_get::<_, Option<String>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v)),
        Type::UUID => row
            .try_get::<_, Option<Uuid>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v.to_string())),
        Type::DATE => row
            .try_get::<_, Option<chrono::NaiveDate>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v.to_string())),
        Type::TIMESTAMP => row
            .try_get::<_, Option<chrono::NaiveDateTime>>(idx)
            .unwrap_or_default()
            .map(|dt| serde_json::json!(dt.to_string()))
            .unwrap_or(Value::Null),
        Type::JSON | Type::JSONB => row
            .try_get::<_, Option<serde_json::Value>>(idx)
            .unwrap_or_default()
            .unwrap_or(Value::Null),
        Type::TIMESTAMPTZ => row
            .try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(idx)
            .unwrap_or_default()
            .map_or(Value::Null, |v| serde_json::json!(v.to_string())),
        _ => {
            if col_type.name() == "vector" {
                row.try_get::<_, Option<Vector>>(idx)
                    .unwrap_or_default()
                    .map_or(Value::Null, |v| serde_json::json!(v.to_vec()))
            } else {
                row.try_get::<_, Option<String>>(idx)
                    .unwrap_or_default()
                    .map_or(Value::Null, |v| serde_json::json!(v))
            }
        }
    }
}
