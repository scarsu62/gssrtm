/**
 * AI Service using direct Google Gemini API endpoints via native fetch.
 * Bypasses the SDK to avoid header-stripping by corporate proxies and environment conflicts.
 */

function getApiKey(apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required. Please set it in Settings or backend environment variables.');
  }
  return key;
}

/**
 * Common call helper to Gemini API
 * @param {string} model 
 * @param {string} prompt 
 * @param {string} apiKey 
 * @returns {Promise<string>} Raw text response from Gemini
 */
async function callGemini(model, prompt, apiKey) {
  const key = getApiKey(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini API Error] Status: ${response.status}, Detail: ${errorText}`);
    let message = `Gemini API returned ${response.status} ${response.statusText}`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error && errJson.error.message) {
        message = errJson.error.message;
      }
    } catch {}
    throw new Error(message);
  }

  const data = await response.json();
  
  try {
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    console.error('[Gemini API Parsing Error] Response structure unexpected:', data);
  }
  
  throw new Error('Gemini API returned an empty or invalid response structure.');
}

/**
 * Deconstructs raw text to structure requirement objects
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} model 
 * @returns {Promise<Array<Object>>} List of { code, name, description }
 */
export async function deconstructRequirements(text, apiKey, model = 'gemini-3.5-flash') {
  const prompt = `你是一位專業的需求工程師。請分析以下從客戶需求書 (RFP) 或系統規格書中擷取出的文字內容。
將其拆解成一個個獨立且具體的「需求項目」（Requirements）。

請回傳一個 JSON 陣列，每個物件代表一個需求項目，欄位格式如下：
{
  "code": "需求編號，如果原始文字有編號（如 REQ-1、1.1.2）請保留，若無請自訂如 REQ-001, REQ-002...",
  "name": "需求名稱（簡短標題，例如：使用者登入、商品搜尋、權限控制）",
  "description": "需求詳細說明與驗證標準"
}

原始文字內容：
"""
${text}
"""`;

  const jsonText = await callGemini(model, prompt, apiKey);
  return JSON.parse(jsonText);
}

/**
 * Deconstructs raw text to structure function objects
 * @param {string} text 
 * @param {string} apiKey 
 * @param {string} model 
 * @returns {Promise<Array<Object>>} List of { code, name, description }
 */
export async function deconstructFunctions(text, apiKey, model = 'gemini-3.5-flash') {
  const prompt = `你是一位系統分析師 (SA)。請分析以下從系統功能規格書 (FSD/SD) 或架構設計文件中擷取出的文字內容。
將其拆解成一個個獨立且具體的「系統功能項目」（Functions/Features）。

請回傳一個 JSON 陣列，每個物件代表一個功能項目，欄位格式如下：
{
  "code": "功能編號，如果原始文字有編號請保留，若無請自訂如 FUN-001, FUN-002...",
  "name": "功能名稱（例如：Google 第三方登入、模糊搜尋框、管理員儀表板）",
  "description": "功能詳細邏輯說明、輸入輸出或實作細節"
}

原始文字內容：
"""
${text}
"""`;

  const jsonText = await callGemini(model, prompt, apiKey);
  return JSON.parse(jsonText);
}

/**
 * Maps requirements to functions based on semantic alignment
 * @param {Array<Object>} requirements List of { code, name, description }
 * @param {Array<Object>} functions List of { code, name, description }
 * @param {string} apiKey 
 * @param {string} model 
 * @returns {Promise<Array<Object>>} List of { requirementCode, functionCode, confidence, reason }
 */
export async function alignTraceability(requirements, functions, apiKey, model = 'gemini-3.5-flash') {
  const prompt = `你是一位系統工程師。現在你需要將「客戶需求清單」與「開發功能清單」進行對齊，建立需求追溯關係 (Requirement Traceability Matrix)。
請評估每個功能（Function）是否能滿足或實現特定需求（Requirement）。

請回傳一個 JSON 陣列，其中包含你分析出所有成立的關聯。每個物件格式如下：
{
  "requirementCode": "被滿足的需求編號（如 REQ-001）",
  "functionCode": "實現此需求的功能編號（如 FUN-001）",
  "confidence": "信心指數，介於 0.0 到 1.0 之間的數值",
  "reason": "繁體中文說明：解釋此功能如何滿足此需求，或者為何兩者存在追溯關係"
}

以下為客戶需求清單 (Requirements)：
${JSON.stringify(requirements, null, 2)}

以下為開發功能清單 (Functions)：
${JSON.stringify(functions, null, 2)}

請僅回傳 JSON 陣列。若某個需求沒有適合的功能對應，無須建立關聯。僅回傳有合理關聯的項目。`;

  const jsonText = await callGemini(model, prompt, apiKey);
  return JSON.parse(jsonText);
}
