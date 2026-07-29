import json
import os

import gspread
from google.oauth2.service_account import Credentials

SHEET_ID = '1Tr7D8-qsGrNDwZH_m-0vCGGIa6NRM4DyaQWSA21ZDhM'
WORKSHEET_NAME = 'G1データ'
CREDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'keiba', 'credentials.json')
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'races.json')

MAX_HORSES = 18


def _connect_sheet():
    scopes = ['https://spreadsheets.google.com/feeds',
              'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    gc = gspread.authorize(creds)
    return gc.open_by_key(SHEET_ID).worksheet(WORKSHEET_NAME)


def _horse_prefix(position: int) -> str:
    return 'winner' if position == 1 else f'horse{position}'


def _to_number(text: str):
    if text == '':
        return None
    try:
        if '.' in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


def row_to_race(row: dict) -> dict:
    horses = []
    for position in range(1, MAX_HORSES + 1):
        prefix = _horse_prefix(position)
        number = row.get(f'{prefix}_number', '')
        if number == '':
            break
        horses.append({
            'position': position,
            'number': _to_number(number),
            'name': row.get(f'{prefix}_name', ''),
            'odds': _to_number(row.get(f'{prefix}_odds', '')),
            'popularity': _to_number(row.get(f'{prefix}_popularity', '')),
        })

    return {
        'race_name': row.get('race_name', ''),
        'year': _to_number(row.get('year', '')),
        'venue': row.get('venue', ''),
        'track': row.get('track', ''),
        'horses': horses,
        # 馬連は1口、ワイドは3口（1-2着 / 1-3着 / 2-3着の順で固定であることを検証済み）
        'quinella_payout': _to_number(row.get('quinella_payout', '')),
        'wide_payout_1_2': _to_number(row.get('wide_payout_1', '')),
        'wide_payout_1_3': _to_number(row.get('wide_payout_2', '')),
        'wide_payout_2_3': _to_number(row.get('wide_payout_3', '')),
    }


def main():
    ws = _connect_sheet()
    values = ws.get_all_values()
    header = values[0]

    races = []
    for raw_row in values[1:]:
        row = dict(zip(header, raw_row))
        races.append(row_to_race(row))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(races, f, ensure_ascii=False, indent=2)

    print(f'{len(races)}件のレースを{OUTPUT_PATH}に書き出しました')


if __name__ == '__main__':
    main()
