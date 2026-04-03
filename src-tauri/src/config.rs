use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IslandConfig {
    pub theme: String,
    pub pet: PetConfig,
    pub sounds: SoundConfig,
    pub agents: HashMap<String, AgentConfig>,
    pub notifications: NotifConfig,
    pub window: WindowConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetConfig {
    #[serde(rename = "type")]
    pub pet_type: String,
    pub animations: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub enabled: bool,
    pub pet: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifConfig {
    #[serde(rename = "showToolEvents")]
    pub show_tool_events: bool,
    #[serde(rename = "autoExpandOnPermission")]
    pub auto_expand_on_permission: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    #[serde(rename = "rememberPosition")]
    pub remember_position: bool,
    #[serde(rename = "defaultPosition")]
    pub default_position: String,
}

impl Default for IslandConfig {
    fn default() -> Self {
        let mut agents = HashMap::new();
        agents.insert("claude".into(), AgentConfig { enabled: true, pet: "crab".into(), color: "#D97757".into() });
        agents.insert("codex".into(), AgentConfig { enabled: true, pet: "robot".into(), color: "#3B82F6".into() });
        agents.insert("gemini".into(), AgentConfig { enabled: true, pet: "dragon".into(), color: "#22C55E".into() });
        agents.insert("cursor".into(), AgentConfig { enabled: true, pet: "ghost".into(), color: "#A78BFA".into() });
        agents.insert("windsurf".into(), AgentConfig { enabled: true, pet: "fox".into(), color: "#06B6D4".into() });

        Self {
            theme: "glass".into(),
            pet: PetConfig { pet_type: "octopus".into(), animations: true },
            sounds: SoundConfig { enabled: true, volume: 0.3 },
            agents,
            notifications: NotifConfig { show_tool_events: true, auto_expand_on_permission: true },
            window: WindowConfig { remember_position: true, default_position: "top-center".into() },
        }
    }
}

pub fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap().join("island.config.json")
}

pub fn load_config(app: &AppHandle) -> IslandConfig {
    let path = config_path(app);
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => IslandConfig::default(),
        }
    } else {
        let cfg = IslandConfig::default();
        let _ = save_config(app, &cfg);
        cfg
    }
}

pub fn save_config(app: &AppHandle, config: &IslandConfig) -> Result<(), std::io::Error> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    fs::write(path, json)
}
