import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supervisor, location, issuedTo, expectedReturn, items } = body;

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL || '',
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || '';

    // 1. Generate the local timestamp string
    // Forces the server to generate the timestamp in India Standard Time (IST)
const localDateTimeString = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false // Set to true if you prefer 12-hour AM/PM format
}).replace(/,/g, ''); // Removes the automated comma between the date and time

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