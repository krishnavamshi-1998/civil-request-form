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

    // Arrays to store our dropdown values safely
    let supervisors: string[] = [];
    let tools: string[] = [];
    let machines: string[] = [];
    let consumableSupervisors: string[] = [];
    let consumableItems: string[] = [];
    let rawItems: string[] = [];
    let returnableItems: string[] = []; // Combines tools & machines

    // ==========================================
    // 🛡️ SAFE FETCH 1: Master Stock Sheet (Tools/Machines/Supervisors/Returnables)
    // ==========================================
    try {
      const mainRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Stock'!A1:Z500` });
      const mainRows = mainRes.data.values || [];
      if (mainRows.length > 1) {
        const headers = mainRows[1].map((h: any) => String(h).trim().toLowerCase());
        const supIdx = headers.findIndex((h: string) => h.includes('supervisor name'));
        const toolIdx = headers.findIndex((h: string) => h.includes('tool name'));
        const machIdx = headers.findIndex((h: string) => h.includes('machine name'));

        mainRows.slice(2).forEach((row: any[]) => {
          // 1. Extract Supervisors
          if (supIdx !== -1 && row[supIdx] && !supervisors.includes(row[supIdx])) {
            supervisors.push(String(row[supIdx]).trim());
          }
          
          // 2. Extract Tools & add to Returnables
          if (toolIdx !== -1 && row[toolIdx]) {
            const toolValue = String(row[toolIdx]).trim();
            if (!tools.includes(toolValue)) tools.push(toolValue);
            if (!returnableItems.includes(toolValue)) returnableItems.push(toolValue);
          }
          
          // 3. Extract Machines & add to Returnables
          if (machIdx !== -1 && row[machIdx]) {
            const machineValue = String(row[machIdx]).trim();
            if (!machines.includes(machineValue)) machines.push(machineValue);
            if (!returnableItems.includes(machineValue)) returnableItems.push(machineValue);
          }
        });
      }
    } catch (e) {
      console.error("Error reading 'Master Stock' sheet:", e);
    }

    // ==========================================
    // 🛡️ SAFE FETCH 2: Consumables Master Stock
    // ==========================================
    try {
      const conRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'Consumables Master Stock'!A1:Z500` });
      const conRows = conRes.data.values || [];
      if (conRows.length > 1) {
        const headers = conRows[1].map((h: any) => String(h).trim().toLowerCase());
        const supIdx = headers.findIndex((h: string) => h.includes('supervisor name'));
        
        // Flexible fallback matching for common consumable item column variations
        const itemIdx = headers.findIndex((h: string) => 
          h.includes('item name') || h.includes('item') || h.includes('consumable name') || h.includes('material')
        );

        conRows.slice(2).forEach((row: any[]) => {
          if (supIdx !== -1 && row[supIdx] && !consumableSupervisors.includes(row[supIdx])) {
            consumableSupervisors.push(String(row[supIdx]).trim());
          }
          if (itemIdx !== -1 && row[itemIdx] && !consumableItems.includes(row[itemIdx])) {
            consumableItems.push(String(row[itemIdx]).trim());
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
      
      if (rawRows.length > 1) {
        let targetHeaderRow = rawRows[1];
        let sliceIndex = 2;

        const hasHeadersInRow2 = rawRows[1] && rawRows[1].some(cell => String(cell).trim() !== '');
        if (!hasHeadersInRow2 && rawRows[0]) {
          targetHeaderRow = rawRows[0];
          sliceIndex = 1;
        }

        const headers = targetHeaderRow.map((h: any) => String(h).trim().toLowerCase());
        const itemIdx = headers.findIndex((h: string) => h === 'item name' || h.includes('item name'));

        if (itemIdx !== -1) {
          rawRows.slice(sliceIndex).forEach((row: any[]) => {
            if (row[itemIdx] && !rawItems.includes(row[itemIdx])) {
              rawItems.push(String(row[itemIdx]).trim());
            }
          });
        }
      }
    } catch (e) {
      console.error("Error reading 'Raw Materials Master Stock' sheet:", e);
    }

    // Clean out empty string values and return final object payloads
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