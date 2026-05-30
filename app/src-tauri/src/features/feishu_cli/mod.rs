mod cli_runtime;
mod cli_update;
mod model;
mod schema;
mod service;

pub use cli_runtime::{resolve_cli_paths, FeishuCliUpdateCheck, FeishuCliUpdateResult};
pub use model::{
    FeishuAuthBeginRequest, FeishuAuthCompleteRequest, FeishuAuthDomainOption,
    FeishuAuthEffectiveState, FeishuAuthPreferences, FeishuAuthPreferencesSaveRequest,
    FeishuAuthPreset, FeishuAuthPresetCatalog, FeishuAuthScopeCatalog, FeishuAuthSyncRequest,
    FeishuAuthSyncResult, FeishuCliHealth, FeishuCliOperationLog, FeishuCliRequest,
    FeishuCliResponse, FeishuConfigInitRequest, FeishuWritePreview,
};
pub use service::FeishuCliService;
