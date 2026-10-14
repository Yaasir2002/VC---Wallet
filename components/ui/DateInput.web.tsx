import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Props = {
  value: Date;
  maximumDate?: Date;
  mode?: string;
  display?: string;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
};

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DateInput({ value, maximumDate, onChange }: Props) {
  return <input
    type="date"
    aria-label="Tanggal lahir"
    value={dateValue(value)}
    max={maximumDate ? dateValue(maximumDate) : undefined}
    onChange={(event) => {
      if (!event.target.value) return;
      const date = new Date(`${event.target.value}T00:00:00`);
      onChange({ type: 'set', nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date);
    }}
    style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #CBD5E1' }}
  />;
}
