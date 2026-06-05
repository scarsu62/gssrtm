import mammoth from 'mammoth';
import xlsx from 'xlsx';

/**
 * Extracts raw text from a Word document (.docx)
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
export async function parseDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Failed to parse docx:', error);
    throw new Error(`Failed to parse Word document: ${error.message}`);
  }
}

/**
 * Extracts grid data from Excel sheet (.xlsx, .xls, .csv)
 * @param {string} filePath 
 * @returns {Promise<Object>} Object mapping sheet names to 2D arrays of data
 */
export async function parseXlsx(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const result = {};
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Convert sheet to grid (array of arrays)
      const grid = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      result[sheetName] = grid;
    }
    return result;
  } catch (error) {
    console.error('Failed to parse xlsx:', error);
    throw new Error(`Failed to parse Excel document: ${error.message}`);
  }
}

/**
 * Helper to convert sheet grid data into simple tab-separated text for AI processing
 * @param {Object} xlsxData 
 * @returns {string}
 */
export function xlsxToText(xlsxData) {
  let text = '';
  for (const [sheetName, grid] of Object.entries(xlsxData)) {
    text += `### Sheet: ${sheetName}\n`;
    for (const row of grid) {
      if (Array.isArray(row) && row.length > 0) {
        // filter out null/undefined, join with tab
        const rowStr = row
          .map(cell => (cell === null || cell === undefined ? '' : String(cell).trim()))
          .join('\t');
        if (rowStr.trim()) {
          text += rowStr + '\n';
        }
      }
    }
    text += '\n';
  }
  return text;
}

/**
 * Attempt to automatically parse structured requirements from an Excel sheet without AI.
 * Looks for common headers like "id", "code", "name", "title", "description", "content"
 * @param {Object} xlsxData 
 * @returns {Array<Object>|null} List of parsed items, or null if structure cannot be determined
 */
export function tryExtractStructuredRows(xlsxData) {
  // Grab the first sheet that has rows
  const sheets = Object.keys(xlsxData);
  if (sheets.length === 0) return null;
  
  let targetSheet = xlsxData[sheets[0]];
  // Find a sheet that looks like it has content if the first one is empty
  for (const name of sheets) {
    if (xlsxData[name] && xlsxData[name].length > 1) {
      targetSheet = xlsxData[name];
      break;
    }
  }
  
  if (!targetSheet || targetSheet.length < 2) return null;
  
  // Find the header row (usually first row, or within first 5 rows)
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(5, targetSheet.length); i++) {
    const row = targetSheet[i];
    if (row && row.length > 1) {
      const containsId = row.some(cell => cell && /id|code|編號|代號/i.test(String(cell)));
      const containsName = row.some(cell => cell && /name|title|名稱|標題|功能/i.test(String(cell)));
      if (containsId || containsName) {
        headerRowIndex = i;
        headers = row.map(cell => (cell ? String(cell).trim().toLowerCase() : ''));
        break;
      }
    }
  }
  
  // If no obvious header was found, assume first row is header
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = targetSheet[0].map(cell => (cell ? String(cell).trim().toLowerCase() : ''));
  }
  
  // Identify columns
  const codeIdx = headers.findIndex(h => /id|code|編號|代號|項次/i.test(h));
  const nameIdx = headers.findIndex(h => /name|title|名稱|標題|項目/i.test(h));
  const descIdx = headers.findIndex(h => /desc|detail|content|描述|內容|說明/i.test(h));
  
  // If we can't find at least a name column, fallback
  if (nameIdx === -1) return null;
  
  const items = [];
  for (let i = headerRowIndex + 1; i < targetSheet.length; i++) {
    const row = targetSheet[i];
    if (!row || row.length === 0) continue;
    
    const nameVal = row[nameIdx];
    if (!nameVal || !String(nameVal).trim()) continue; // skip empty rows
    
    const codeVal = codeIdx !== -1 ? row[codeIdx] : null;
    const descVal = descIdx !== -1 ? row[descIdx] : null;
    
    items.push({
      code: codeVal ? String(codeVal).trim() : '',
      name: String(nameVal).trim(),
      description: descVal ? String(descVal).trim() : '',
    });
  }
  
  return items.length > 0 ? items : null;
}
