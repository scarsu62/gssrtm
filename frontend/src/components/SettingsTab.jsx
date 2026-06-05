import React, { useState } from 'react';

function SettingsTab({ initialApiKey, initialModel, onSave }) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [model, setModel] = useState(initialModel);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(apiKey.trim(), model);
  };

  return (
    <div className="glass-panel">
      <h3>🛠️ 系統參數設定 (Settings)</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '2rem' }}>
        設定您的 Gemini API 金鑰與模型參數，以啟用自動拆解及需求追溯關聯推薦功能。
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Gemini API Key</span>
            <span 
              onClick={() => setShowKey(!showKey)} 
              style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-accent-cyan)' }}
            >
              {showKey ? '👁️ 隱藏金鑰' : '👁️ 顯示金鑰'}
            </span>
          </label>
          <input 
            type={showKey ? 'text' : 'password'} 
            className="form-control" 
            placeholder={apiKey ? '••••••••••••••••••••••••••••••••' : '輸入您的 AIzaSy... 金鑰'} 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)} 
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
            ℹ️ 金鑰將安全地儲存在您本地瀏覽器的 <strong>LocalStorage</strong> 中，所有 AI 運算皆從您的瀏覽器或本地服務發送，安全性無虞。
            您也可以在後端資料夾的 <code>.env</code> 檔案中設定 <code>GEMINI_API_KEY</code> 作為伺服器預設值。
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">預設生成 AI 模型 (Model Name)</label>
          <select 
            className="form-control" 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (極速、平衡，推薦)</option>
            <option value="gemini-3.5-pro">Gemini 3.5 Pro (高度複雜推論、分析力更強)</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          💾 儲存系統設定
        </button>
      </form>
    </div>
  );
}

export default SettingsTab;
