import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PBX_DEVICE_BRANDS } from '@/data/pbxDeviceModels';
import { LEMTEL_ORG } from '@/hooks/usePbxData';

export interface DeviceCatalog {
  vendors: string[];
  modelsByVendor: Record<string, { model: string; template: string }[]>;
  live: boolean;
}

function buildStatic(): DeviceCatalog {
  const modelsByVendor: DeviceCatalog['modelsByVendor'] = {};
  for (const [vendor, models] of Object.entries(PBX_DEVICE_BRANDS)) {
    modelsByVendor[vendor] = (models as string[]).map((m) => ({
      model: m,
      template: `${vendor.toLowerCase().split('/')[0]}/${m}`,
    }));
  }
  return { vendors: Object.keys(PBX_DEVICE_BRANDS), modelsByVendor, live: false };
}

export function usePbxDeviceCatalog() {
  return useQuery<DeviceCatalog>({
    queryKey: ['pbx', 'device-catalog'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      try {
        const [v, t] = await Promise.all([
          supabase.functions.invoke('fusionpbx-proxy', {
            body: { organization_id: LEMTEL_ORG, action: 'list-device-vendors' },
          }),
          supabase.functions.invoke('fusionpbx-proxy', {
            body: { organization_id: LEMTEL_ORG, action: 'list-device-templates' },
          }),
        ]);
        const vendors = (v.data?.data || []) as any[];
        const templates = (t.data?.data || []) as any[];
        if (!vendors.length || v.data?.fallback || t.data?.fallback) return buildStatic();

        const modelsByVendor: DeviceCatalog['modelsByVendor'] = {};
        for (const tpl of templates) {
          const vendor = tpl.device_vendor || tpl.vendor_name || '';
          const model = tpl.device_template || tpl.template || tpl.device_model || '';
          if (!vendor || !model) continue;
          const arr = (modelsByVendor[vendor] ||= []);
          arr.push({ model, template: model });
        }
        const vendorNames = vendors.map((x: any) => x.device_vendor || x.vendor_name).filter(Boolean);
        if (!vendorNames.length || !Object.keys(modelsByVendor).length) return buildStatic();
        return { vendors: vendorNames, modelsByVendor, live: true };
      } catch {
        return buildStatic();
      }
    },
  });
}
