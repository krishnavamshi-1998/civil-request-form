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

    // Fetch lists from spreadsheets (including Row 2 headers matching for safety)
    const [mainRes, conRes, rawRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'Master Stock'!A1:Z500` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'Consumables Master Stock'!A1:Z500` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'Raw Materials Master Stock'!A1:Z500` }), // 👈 New sheet
    ]);

    const mainRows = mainRes.data.values || [];
    const conRows = conRes.data.values || [];
    const rawRows = rawRes.data.values || [];

    // 1. Process Master Stock Sheet (Supervisor names in row 2)
    let supervisors: string[] = [];
    let tools: string[] = [];
    let machines: string[] = [];

    if (mainRows.length > 1) {
      const headers = mainRows[1].map((h: any) => String(h).trim().toLowerCase());
      const supIdx = headers.findIndex((h: string) => h.includes('supervisor name'));
      const toolIdx = headers.findIndex((h: string) => h.includes('tool name'));
      const machIdx = headers.findIndex((h: string) => h.includes('machine name'));

      mainRows.slice(2).forEach((row: any[]) => {
        if (supIdx !== -1 && row[supIdx] && !supervisors.includes(row[supIdx])) {
          supervisors.push(String(row[supIdx]).trim());
        }
        if (toolIdx !== -1 && row[toolIdx] && !tools.includes(row[toolIdx])) {
          tools.push(String(row[toolIdx]).trim());
        }
        if (machIdx !== -1 && row[machIdx] && !machines.includes(row[machIdx])) {
          machines.push(String(row[machIdx]).trim());
        }
      });
    }

    // 2. Process Consumables Stock (Row 2 Header map matching)
    let consumableSupervisors: string[] = [];
    let consumableItems: string[] = [];

    if (conRows.length > 1) {
      const headers = conRows[1].map((h: any) => String(h).trim().toLowerCase());
      const supIdx = headers.findIndex((h: string) => h.includes('supervisor name'));
      const itemIdx = headers.findIndex((h: string) => h.includes('item name'));

      conRows.slice(2).forEach((row: any[]) => {
        if (supIdx !== -1 && row[supIdx] && !consumableSupervisors.includes(row[supIdx])) {
          consumableSupervisors.push(String(row[supIdx]).trim());
        }
        if (itemIdx !== -1 && row[itemIdx] && !consumableItems.includes(row[itemIdx])) {
          consumableItems.push(String(row[itemIdx]).trim());
        }
      });
    }

    // 3. Process Raw Materials Stock (Row 2 Header map matching)
    let rawItems: string[] = [];
    if (rawRows.length > 1) {
      const headers = rawRows[1].map((h: any) => String(h).trim().toLowerCase());
      const itemIdx = headers.findIndex((h: string) => h === 'item name' || h.includes('item name'));

      rawRows.slice(2).forEach((row: any[]) => {
        if (itemIdx !== -1 && row[itemIdx] && !rawItems.includes(row[itemIdx])) {
          rawItems.push(String(row[itemIdx]).trim());
        }
      });
    }

    return NextResponse.json({
      success: true,
      supervisors: supervisors.filter(Boolean),
      tools: tools.filter(Boolean),
      machines: machines.filter(Boolean),
      consumableSupervisors: consumableSupervisors.length > 0 ? consumableSupervisors.filter(Boolean) : supervisors.filter(Boolean),
      consumableItems: consumableItems.filter(Boolean),
      rawItems: rawItems.filter(Boolean), // 👈 Output values
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}