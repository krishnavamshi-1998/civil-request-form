import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL || '',
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID || '',
      ranges: [
        'Master Stock!R3:R', // Supervisor Names
        'Master Stock!B3:B', // Tool Names
        'Master Stock!J3:J', // Machine Names
      ],
    });

    // Extract valueRanges with fallback to prevent undefined errors
    const valueRanges = response.data.valueRanges || [];
    
    // Explicitly define the row parameter as a string array matrix to resolve strict typing errors
    const cleanList = (rows: string[][] | undefined | null) => {
      if (!rows) return [];
      return Array.from(new Set(rows.map(row => row[0]).filter(Boolean)));
    };

    // Grab by matching structural indexes from our range array safely using type casting
    const supervisors = cleanList(valueRanges[0]?.values as string[][] | undefined);
    const tools = cleanList(valueRanges[1]?.values as string[][] | undefined);
    const machines = cleanList(valueRanges[2]?.values as string[][] | undefined);

    return NextResponse.json({ supervisors, tools, machines });
  } catch (error: any) {
    console.error('Dropdown Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}