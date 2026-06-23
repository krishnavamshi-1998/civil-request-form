import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // BULLETPROOF KEY SANITIZER FOR VERCEL
    if (!privateKey || !email) {
      throw new Error(`Environment variables missing! Email found: ${!!email}, Key found: ${!!privateKey}`);
    }

    // Remove stray wrapping quotes if Vercel added them automatically
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }

    // Fix escaped newline characters common in cloud host setups
    privateKey = privateKey.replace(/\\n/g, '\n');

    // 1. Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 2. Fetch the data directly from the Master Stock tab
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        'Master Stock!B3:B', 
        'Master Stock!J3:J', 
        'Master Stock!R3:R', 
      ],
    });

    const valueRanges = response.data.valueRanges || [];

    const toolsRaw = valueRanges[0] && valueRanges[0].values ? valueRanges[0].values : [];
    const machinesRaw = valueRanges[1] && valueRanges[1].values ? valueRanges[1].values : [];
    const supervisorsRaw = valueRanges[2] && valueRanges[2].values ? valueRanges[2].values : [];

    const tools = toolsRaw
      .flat()
      .filter((item) => item && item.trim() !== '')
      .map((item) => ({ name: item, stock: 'Available' }));

    const machines = machinesRaw
      .flat()
      .filter((item) => item && item.trim() !== '')
      .map((item) => ({ name: item, stock: 'Available' }));

    const supervisors = supervisorsRaw
      .flat()
      .filter((item) => item && item.trim() !== '') as string[];

    return NextResponse.json({
      success: true,
      supervisors,
      tools,
      machines,
    });

  } catch (error: any) {
    console.error('--- VERCEL RUNTIME ERROR HANDLER ---');
    console.error(error.message || error);
    
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tracking dropdown entries' },
      { status: 500 }
    );
  }
}