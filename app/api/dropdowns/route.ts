import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL || '',
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID || '';

    // Adjust target ranges depending on your precise sheet column design
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ['Supervisors!A:A', 'MasterStock!A:C'], 
    });

    const valueRanges = response.data.valueRanges || [];
    
    // Process Supervisors list (skipping label row 1)
    const rawSupervisors = valueRanges[0]?.values || [];
    const supervisorsList = rawSupervisors.slice(1).map(row => row[0]).filter(Boolean);

    // Process Stock List
    const stockRows = valueRanges[1]?.values || [];
    const toolsCollection: any[] = [];
    const machinesCollection: any[] = [];

    stockRows.slice(1).forEach((row) => {
      const name = row[0];
      const category = row[1]; // Expects 'Tools' or 'Machine' text
      const stockAmount = row[2] || 0;

      if (!name) return;

      if (category === 'Tools') {
        toolsCollection.push({ name, stock: stockAmount });
      } else if (category === 'Machine') {
        machinesCollection.push({ name, stock: stockAmount });
      }
    });

    return NextResponse.json({
      success: true,
      supervisors: supervisorsList,
      tools: toolsCollection,
      machines: machinesCollection
    });
  } catch (error: any) {
    console.error('Dropdown asset compilation failure:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}