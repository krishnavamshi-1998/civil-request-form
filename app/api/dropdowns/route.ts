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

    // Supervisors are now stored as objects: { name: string, phone: string }
    let supervisors: { name: string; phone: string }[] = [];
    let tools: string[] = [];
    let machines: string[] = [];
    
    // Consumables variables
    let consumableSupervisors: { name: string; phone: string }[] = [];
    let consumableItems: string[] = [];
    
    let rawItems: string[] = [];
    let returnableItems: string[] = [];

    // Helper utility to find a column index dynamically (Rows 1 & 2)
    const findColumnIndex = (rows: any[][], searchTerms: string[]): { index: number; dataStartRow: number } => {
      if (!rows || rows.length === 0) return { index: -1, dataStartRow: 1 };
      
      if (rows.length > 1 && rows[1]) {
        const row2Headers = rows[1].map((h: any) => String(h).trim().toLowerCase());
        const matchIdx = row2Headers.findIndex((h: string) => searchTerms.some(term => h.includes(term)));
        if (matchIdx !== -1) return { index: matchIdx, dataStartRow: 2 };
      }
      
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
        const supMatch = findColumnIndex(mainRows, ['supervisor name', 'supervisor']);
        // Scan specifically for "Supervisor Contact" or "Contact" 
        const contactMatch = findColumnIndex(mainRows, ['supervisor contact', 'contact', 'phone', 'mobile']);
        const toolMatch = findColumnIndex(mainRows, ['tools name', 'tool name', 'tool']);
        const machMatch = findColumnIndex(mainRows, ['machines name', 'machine name', 'machine']);

        const startRow = Math.max(supMatch.dataStartRow, contactMatch.dataStartRow, toolMatch.dataStartRow, machMatch.dataStartRow);

        mainRows.slice(startRow).forEach((row: any[]) => {
          // Extract Supervisor Name & Supervisor Contact
          if (supMatch.index !== -1 && row[supMatch.index]) {
            const nameVal = String(row[supMatch.index]).trim();
            const phoneVal = contactMatch.index !== -1 && row[contactMatch.index] ? String(row[contactMatch.index]).trim() : '';
            
            if (nameVal && !supervisors.some(s => s.name === nameVal)) {
              supervisors.push({ name: nameVal, phone: phoneVal });
            }
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
          // If Consumables sheet lists custom supervisor columns, capture them
          if (supMatch.index !== -1 && row[supMatch.index]) {
            const nameVal = String(row[supMatch.index]).trim();
            // Try to look up contact matching Tools sheet, fallback to empty string if not found
            const matchedContact = supervisors.find(s => s.name === nameVal)?.phone || '';
            
            if (nameVal && !consumableSupervisors.some(s => s.name === nameVal)) {
              consumableSupervisors.push({ name: nameVal, phone: matchedContact });
            }
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

    // Filter helper for supervisor objects ensuring we only return valid populated objects
    const validSupervisors = supervisors.filter(s => s.name);
    const validConsumableSupervisors = consumableSupervisors.length > 0 
      ? consumableSupervisors.filter(s => s.name) 
      : validSupervisors;

    return NextResponse.json({
      success: true,
      supervisors: validSupervisors,
      tools: tools.filter(Boolean),
      machines: machines.filter(Boolean),
      consumableSupervisors: validConsumableSupervisors,
      consumableItems: consumableItems.filter(Boolean),
      rawItems: rawItems.filter(Boolean),
      returnableItems: returnableItems.filter(Boolean)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}