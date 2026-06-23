import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supervisor, location, issuedTo, expectedReturn, items } = body;

    // 1. First, parse the entire credentials block from Vercel
const credentials = JSON.parse(process.env.GOOGLE_CREDS || '{}');

// 2. Pass it directly into the Google Auth constructor
const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || '';

    // 1. Generate the local timestamp string
    const now = new Date();
    const localDateTimeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 2. Fetch the current rows from both sheets to compute the next S.No
    const existingRows = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ['Tools!A:A', 'Machines!A:A'],
    });
        
const toolsCount = existingRows.data.valueRanges?.[0]?.values?.length || 1;
const machinesCount = existingRows.data.valueRanges?.[1]?.values?.length || 1;
    let nextToolsSNo = toolsCount; 
    let nextMachinesSNo = machinesCount;

    // 3. Separate your form array into two distinct action buckets
    const toolRows: any[][] = [];
    const machineRows: any[][] = [];

    items.forEach((item: any) => {
      // Base row layout: [S.No (A), Timestamp (B), Supervisor (C), Location (D), Issued To (E), Name (F), Qty (G), Return (H)]
      if (item.type === 'Tools') {
        toolRows.push([
          nextToolsSNo++, 
          localDateTimeString, 
          supervisor, 
          location, 
          issuedTo, 
          item.itemName, 
          item.quantity, 
          expectedReturn
        ]);
      } else if (item.type === 'Machine') {
        machineRows.push([
          nextMachinesSNo++, 
          localDateTimeString, 
          supervisor, 
          location, 
          issuedTo, 
          item.itemName, 
          item.quantity, 
          expectedReturn
        ]);
      }
    });

    // 4. Send the partitioned records to their respective tabs in parallel
    const writePromises = [];

    if (toolRows.length > 0) {
      writePromises.push(
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Tools!A:H',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: toolRows },
        })
      );
    }

    if (machineRows.length > 0) {
      writePromises.push(
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Machines!A:H',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: machineRows },
        })
      );
    }

    await Promise.all(writePromises);

    return NextResponse.json({ success: true, message: 'Sorted entries logged successfully.' });
  } catch (error: any) {
    console.error('Submission handling error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}