import { AltitudeChart } from '../components/AltitudeChart';
import { ClimbRateChart } from '../components/ClimbRateChart';
import { TemperatureChart } from '../components/TemperatureChart';
import { HumidityChart } from '../components/HumidityChart';
import { PressureChart } from '../components/PressureChart';
import { BatteryChart } from '../components/BatteryChart';
import { UVChart } from '../components/UVChart';
import { AccelerationChart } from '../components/AccelerationChart';

export function ChartsPage() {
  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AltitudeChart />
        <ClimbRateChart />
        <TemperatureChart />
        <HumidityChart />
        <PressureChart />
        <BatteryChart />
        <UVChart />
        <AccelerationChart />
      </div>
    </div>
  );
}
