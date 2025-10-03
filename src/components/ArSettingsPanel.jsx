import React from 'react';

// A reusable component for a single locked slider
const LockedSlider = ({ label, value, unit = '', textValue }) => {
  // Determine min/max based on expected value ranges
  const max = unit === '%' ? 100 : Math.max(1, value * 2, 10);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div className="relative w-full">
        {/* Simple visual track */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-700 rounded-full"></div>
        {/* Filled part of the track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-full"
          style={{ width: `${(value / max) * 100}%` }}
        ></div>
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-500 shadow-md"
          style={{ left: `calc(${(value / max) * 100}% - 8px)` }}
        ></div>
      </div>
      <span className="text-xs text-gray-400 mt-2">{textValue}</span>
    </div>
  );
};


const ArSettingsPanel = () => {
  // Define all the locked values based on your image
  const settings = {
    finish: 'Satin',
    stability: 0.50,
    edgeSoftness: 1.0,
    maskGrow: 0.0,
    innerCut: 22, // as a percentage
  };

  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl w-full max-w-sm font-sans">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        {/* Finish Dropdown */}
        <div className="flex flex-col gap-2">
          <label htmlFor="finish-select" className="text-sm font-medium text-gray-300">
            Finish
          </label>
          <select
            id="finish-select"
            value={settings.finish}
            disabled
            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm appearance-none cursor-not-allowed opacity-70"
          >
            <option>{settings.finish}</option>
          </select>
        </div>

        {/* Stability Slider */}
        <div className="flex flex-col gap-2">
           <LockedSlider
              label="Stability (smoothing)"
              value={settings.stability}
              textValue={`${settings.stability.toFixed(2)} (higher = steadier)`}
            />
        </div>

        {/* Edge Softness Slider */}
        <div className="col-span-2">
          <LockedSlider
              label="Edge softness"
              value={settings.edgeSoftness}
              unit="px"
              textValue={`${settings.edgeSoftness.toFixed(1)} px`}
            />
        </div>

        {/* Mask Grow Slider */}
        <div className="col-span-2">
           <LockedSlider
              label="Mask grow (dilate)"
              value={settings.maskGrow}
              unit="px"
              textValue={`${settings.maskGrow.toFixed(1)} px`}
            />
        </div>

        {/* Inner Cut Slider */}
        <div className="col-span-2">
           <LockedSlider
              label="Inner cut (tighten)"
              value={settings.innerCut}
              unit="%"
              textValue={`${settings.innerCut}% tighter`}
            />
        </div>
        
        {/* Buttons */}
        <div className="col-span-2 pt-4 flex items-center justify-start gap-3">
            <button disabled className="px-4 py-1.5 text-sm bg-gray-700 rounded-md cursor-not-allowed opacity-70">
                Mirror: On
            </button>
            <button disabled className="px-4 py-1.5 text-sm bg-gray-700 rounded-md cursor-not-allowed opacity-70">
                Pause
            </button>
            <button disabled className="px-4 py-1.5 text-sm bg-gray-700 rounded-md cursor-not-allowed opacity-70">
                Debug
            </button>
        </div>
      </div>
    </div>
  );
};

export default ArSettingsPanel;