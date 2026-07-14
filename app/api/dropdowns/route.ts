import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!privateKey || !email || !spreadsheetId) throw new Error('Missing configuration.');
    privateKey = privateKey.startsWith('"') && privateKey.endsWith('"') ? privateKey.slice(1, -1) : privateKey;
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let supervisors: string[] = [];
    let tools: string[] = [];
    let machines: string[] = [];
    let consumableSupervisors: string[] = [];
    let consumableItems: string[] = [];
    let rawItems: string[] = [];
    let returnableItems: string[] = [];

    // Helper utility to find a column index by checking both Row 1 and Row 2 dynamically
    const findColumnIndex = (rows: any[][], searchTerms: string[]): { index: number; dataStartRow: number } => {
      if (!rows || rows.length === 0) return { index: -1, dataStartRow: 1 };
      
      // Try scanning Row 2 first (Index 1)
      if (rows.length > 1 && rows[1]) {
        const row2Headers = rows[1].map((h: any) => String(h).trim().toLowerCase());
        const matchIdx = row2Headers.findIndex((h: string) => searchTerms.some(term => h.includes(term)));
        if (matchIdx !== -1) return { index: matchIdx, dataStartRow: 2 };
      }
      
      // Fallback: Scan Row 1 (Index 0)
      if (rows[0]) {
        const row1Headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
        const matchIdx = row1Headers.findIndex((h: string) => searchTerms.some(term => h.includes(term)));
        if (matchIdx !== -1) return { index: matchIdx, dataStartRow: 1 };
      }

      return { index: -1, dataStartRow: 1 };
    };

    // ==========================================
    // 🛡️ SAFE FETCH 1: Tools and Machines Master Stock
    // ==========================================
    try {
      const mainRes = await sheets.spreadsheets.values.get({ 
        spreadsheetId, 
        range: `'Tools and Machines Master Stock'!A1:Z500` 
      });
      const mainRows = mainRes.data.values || [];
      
      if (mainRows.length > 0) {
        // Updated search phrases to perfectly match 'Tools Name' and 'Machines Name'
        const supMatch = findColumnIndex(mainRows, ['supervisor name', 'supervisor']);
        const toolMatch = findColumnIndex(mainRows, ['tools name', 'tool name', 'tool']);
        const machMatch = findColumnIndex(mainRows, ['machines name', 'machine name', 'machine']);

        const startRow = Math.max(supMatch.dataStartRow, toolMatch.dataStartRow, machMatch.dataStartRow);

        mainRows.slice(startRow).forEach((row: any[]) => {
          if (supMatch.index !== -1 && row[supMatch.index] && !supervisors.includes(row[supMatch.index])) {
            supervisors.push(String(row[supMatch.index]).trim());
          }
          if (toolMatch.index !== -1 && row[toolMatch.index]) {
            const toolValue = String(row[toolMatch.index]).trim();
            if (toolValue) {
              if (!tools.includes(toolValue)) tools.push(toolValue);
              if (!returnableItems.includes(toolValue)) returnableItems.push(toolValue);
            }
          }
          if (machMatch.index !== -1 && row[machMatch.index]) {
            const machineValue = String(row[machMatch.index]).trim();
            if (machineValue) {
              if (!machines.includes(machineValue)) machines.push(machineValue);
              if (!returnableItems.includes(machineValue)) returnableItems.push(machineValue);
            }
          }
        });
      }
    } catch (e) {
      console.error("Error reading 'Tools and Machines Master Stock' sheet:", e);
    }

    // ==========================================
    // 🛡️ SAFE FETCH 2: Consumables Master Stock
    // ==========================================
    try {
      const conRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Consumables Master Stock'!A1:Z500` });
      const conRows = conRes.data.values || [];
      
      if (conRows.length > 0) {
        const supMatch = findColumnIndex(conRows, ['supervisor name', 'supervisor']);
        const itemMatch = findColumnIndex(conRows, ['item name', 'item', 'consumable name', 'material']);
        
        const startRow = Math.max(supMatch.dataStartRow, itemMatch.dataStartRow);

        conRows.slice(startRow).forEach((row: any[]) => {
          if (supMatch.index !== -1 && row[supMatch.index] && !consumableSupervisors.includes(row[supMatch.index])) {
            consumableSupervisors.push(String(row[supMatch.index]).trim());
          }
          if (itemMatch.index !== -1 && row[itemMatch.index]) {
            const itemValue = String(row[itemMatch.index]).trim();
            if (itemValue && !consumableItems.includes(itemValue)) {
              consumableItems.push(itemValue);
            }
          }
        });
      }
    } catch (e) {
      console.error("Error reading 'Consumables Master Stock' sheet:", e);
    }

    // ==========================================
    // 🛡️ SAFE FETCH 3: Raw Materials Master Stock
    // ==========================================
    try {
      const rawRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Raw Materials Master Stock'!A1:Z500` });
      const rawRows = rawRes.data.values || [];
      
      if (rawRows.length > 0) {
        const itemMatch = findColumnIndex(rawRows, ['item name', 'item', 'raw material']);
        
        rawRows.slice(itemMatch.dataStartRow).forEach((row: any[]) => {
          if (itemMatch.index !== -1 && row[itemMatch.index]) {
            const itemValue = String(row[itemMatch.index]).trim();
            if (itemValue && !rawItems.includes(itemValue)) {
              rawItems.push(itemValue);
            }
          }
        });
      }
    } catch (e) {
      console.error("Error reading 'Raw Materials Master Stock' sheet:", e);
    }

    return NextResponse.json({
      success: true,
      supervisors: supervisors.filter(Boolean),
      tools: tools.filter(Boolean),
      machines: machines.filter(Boolean),
      consumableSupervisors: consumableSupervisors.length > 0 ? consumableSupervisors.filter(Boolean) : supervisors.filter(Boolean),
      consumableItems: consumableItems.filter(Boolean),
      rawItems: rawItems.filter(Boolean),
      returnableItems: returnableItems.filter(Boolean)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}