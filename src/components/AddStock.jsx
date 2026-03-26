import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabaseAdmin } from '../lib/supabaseClient';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { PageHeader } from './PageHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';
import { DEFAULT_MATERIAL_CONFIGS, DEFAULT_SUPPLIERS } from '../config/material';

// Load from localStorage or use defaults
const getStoredSuppliers = () => {
  try {
    const stored = localStorage.getItem('shobe-suppliers');
    return stored ? JSON.parse(stored) : DEFAULT_SUPPLIERS;
  } catch {
    return DEFAULT_SUPPLIERS;
  }
};

const getStoredMaterialConfigs = () => {
  try {
    const stored = localStorage.getItem('shobe-material-configs');
    return stored ? JSON.parse(stored) : DEFAULT_MATERIAL_CONFIGS;
  } catch {
    return DEFAULT_MATERIAL_CONFIGS;
  }
};

function generateSKU(material, subOption, supplier, shirtType, shirtSize, shirtColor, existingSKUs = [], otherMaterialName, otherSize, otherType, otherUnit, isCustomMaterial) {
  // Supplier code mapping
  let supplierCode = '';
  if (supplier === 'Black Horse') {
    supplierCode = 'BH';
  } else if (supplier === 'Apple Tee') {
    supplierCode = 'AT';
  } else {
    // First 2 letters of supplier name for other suppliers
    supplierCode = supplier
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2) || 'SU';
  }

  let widthCode = '';
  let thicknessCode = '';
  let materialCode = '';

  // Normalize strings to lower case for matching
  const materialLc = material.toLowerCase();
  const subOptionLc = subOption.toLowerCase();

  // Handle "Others" material or custom materials (when selected from dropdown)
  if ((materialLc === 'others' && otherMaterialName) || isCustomMaterial) {
    const materialName = isCustomMaterial ? material : otherMaterialName;
    const materialCode = materialName.slice(0, 3).toUpperCase();
    const sizeCode = otherSize ? otherSize.slice(0, 2).toUpperCase() : '';
    const typeCode = otherType ? otherType.slice(0, 2).toUpperCase() : '';
    const dateAdded = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    const baseSKU = `${supplierCode}${sizeCode}${typeCode}${materialCode}${dateAdded}`.slice(0, 14);
    
    // Check for duplicates and add batch number if needed
    let finalSKU = baseSKU;
    let batchNumber = 1;
    
    while (existingSKUs.includes(finalSKU)) {
      const batchSuffix = batchNumber.toString().padStart(2, '0');
      finalSKU = `${baseSKU}${batchSuffix}`.slice(0, 18);
      batchNumber++;
    }
    
    return finalSKU;
  }

  // Handle Round neck shirt
  if (materialLc === 'round neck shirt' && shirtType && shirtSize && shirtColor) {
    // Type code
    const typeCode = shirtType === 'Cotton' ? 'CT' : 'DF';
    
    // Size code mapping
    const sizeCodeMap = {
      'Size 8': '8', 'Size 10': '10', 'Size 12': '12', 'Size 14': '14', 
      'Size 16': '16', 'Size 18': '18', 'XS': 'XS', 'Small': 'S', 
      'Medium': 'M', 'Large': 'L', 'XL': 'XL', 'XXL': '2XL'
    };
    const sizeCode = sizeCodeMap[shirtSize] || 'XX';
    
    // Color code mapping
    const colorCodeMap = {
      'Light Yellow': 'LTY', 'Red': 'R', 'Royal Blue': 'RB', 'Emerald Green': 'EG',
      'Yellow Gold': 'YG', 'Maroon': 'MN', 'Apple Green': 'AG', 'Sunkist': 'SK',
      'Orange': 'OR', 'Teal Green': 'TG', 'Avocado': 'AV', 'Fuschia': 'FC',
      'Magenta': 'MG', 'Muroise': 'MR', 'Aqua Blue': 'AQB', 'Aqua Marine': 'AM',
      'Navy Blue': 'NB', 'Acid Gray': 'ACG', 'White': 'W', 'Mint Green': 'MTG',
      'Flesh': 'FL', 'Light Blue': 'LTB', 'Gray': 'G', 'Peach': 'P',
      'Light Pink': 'LTP', 'Lavender': 'LV', 'Violet': 'V', 'Deep Cobalt': 'DC',
      'Acid Blue': 'ACB', 'Cayenne': 'CN', 'Lyson Blue': 'LYB', 'Black': 'BL',
      'Neon Orange': 'NO', 'Neon Green': 'NG', 'Army Green': 'AG'
    };
    const colorCode = colorCodeMap[shirtColor] || 'XX';
    
    // Get current date in YYMMDD format
    const dateAdded = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    // Format: supplier + RN + type + size + color + date
      const baseSKU = `${supplierCode}RN${typeCode}${sizeCode}${colorCode}${dateAdded}`.slice(0, 18);
    
    // Check for duplicates and add batch number if needed
    let finalSKU = baseSKU;
    let batchNumber = 1;
    
    while (existingSKUs.includes(finalSKU)) {
      const batchSuffix = batchNumber.toString().padStart(2, '0');
      finalSKU = `${baseSKU}${batchSuffix}`.slice(0, 18);
      batchNumber++;
    }
    
    return finalSKU;
  }

  if (materialLc === 'tarpaulin' && subOption) {
    const widthMatch = subOptionLc.match(/(\d)ft/);
    if (widthMatch) widthCode = `${widthMatch[1]}F`;
    thicknessCode = subOptionLc.includes('8oz') ? 'A9' : 'C12';
    materialCode = 'TP';
  } else if (materialLc === 'vinyl sticker' && subOption) {
    const widthMatch = subOptionLc.match(/(\d)ft/);
    widthCode = widthMatch ? `${widthMatch[1]}F` : 'VX';
    thicknessCode = 'VN';
    materialCode = 'ST';
  } else if (materialLc === 'laminating film' && subOption) {
    const widthMatch = subOptionLc.match(/(\d)ft/);
    widthCode = widthMatch ? `${widthMatch[1]}F` : 'LX';
    thicknessCode = subOptionLc.includes('matte') ? 'MT' : 'GL'; // MT for matte, GL for glossy
    materialCode = 'LM';
  } else if (materialLc === 'sintra board' && subOption) {
    if (subOptionLc.includes('a4')) {
      widthCode = 'A4';
    } else if (subOptionLc.includes('a3')) {
      widthCode = 'A3';
    } else if (subOptionLc.includes('a2')) {
      widthCode = 'A2';
    }

    // Handle thickness (3mm or 5mm)
    if (subOptionLc.includes('3mm')) {
      thicknessCode = '03';  // 3mm
    } else if (subOptionLc.includes('5mm')) {
      thicknessCode = '05';  // 5mm
    } else {
      thicknessCode = '00';  // Default or unknown thickness
    }

    materialCode = 'SBD';
  } else if (materialLc === 'pull-up banner' && subOption) {
    widthCode = '2765';
    materialCode = 'PB';
  } else if (materialLc === 'x-banner' && subOption) {
    widthCode = subOptionLc.includes('2ft') ? '2F' : '25';
    materialCode = 'XB';
  } else if (materialLc.includes('ink') && ['cyan ink', 'magenta ink', 'yellow ink', 'black ink'].includes(materialLc)) {
    // Ink SKU example: AM + CY + IN for Cyan Ink
    const colorCode = materialLc.split(' ')[0].slice(0, 2).toUpperCase(); // CY, MA, YE, BL
    const dateAdded = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // Example: 230926
    const baseSKU = `${supplierCode}${colorCode}IN${dateAdded}`.slice(0, 14);
    
    // Check for duplicates and add batch number if needed
    let finalSKU = baseSKU;
    let batchNumber = 1;
    
    while (existingSKUs.includes(finalSKU)) {
      const batchSuffix = batchNumber.toString().padStart(2, '0');
      finalSKU = `${baseSKU}${batchSuffix}`.slice(0, 18);
      batchNumber++;
    }
    
    return finalSKU;
  } else {
    // Default fallback SKU
    const baseSKU = `${supplierCode}${material.slice(0, 4).toUpperCase()}XX`.slice(0, 14);
    
    // Check for duplicates and add batch number if needed
    let finalSKU = baseSKU;
    let batchNumber = 1;
    
    while (existingSKUs.includes(finalSKU)) {
      const batchSuffix = batchNumber.toString().padStart(2, '0');
      finalSKU = `${baseSKU}${batchSuffix}`.slice(0, 18);
      batchNumber++;
    }
    
    return finalSKU;
  }

  // Get current date in YYMMDD format
  const dateAdded = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // Example: 230926

  // Compose SKU and limit to 18 chars max
  const baseSKU = `${supplierCode}${widthCode}${thicknessCode}${materialCode}${dateAdded}`.slice(0, 18);
  
  // Check for duplicates and add batch number if needed
  let finalSKU = baseSKU;
  let batchNumber = 1;
  
  while (existingSKUs.includes(finalSKU)) {
    const batchSuffix = batchNumber.toString().padStart(2, '0');
    finalSKU = `${baseSKU}${batchSuffix}`.slice(0, 18);
    batchNumber++;
  }
  
  return finalSKU;
}

export function AddStock({ onAddStock, currentUser, onLogout, lowStockItems = [], inventory, onAddMaterial, onNavigateToAccount }) {
  const [material, setMaterial] = useState('');
  const [subOption, setSubOption] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [sku, setSku] = useState('');
  const [generatedSKU, setGeneratedSKU] = useState('');
  
  // Round neck shirt specific states
  const [shirtType, setShirtType] = useState('');
  const [shirtColor, setShirtColor] = useState('');
  const [shirtSize, setShirtSize] = useState('');
  
  // Others material specific states
  const [otherMaterialName, setOtherMaterialName] = useState('');
  const [otherSize, setOtherSize] = useState('');
  const [otherType, setOtherType] = useState('');
  const [otherUnit, setOtherUnit] = useState('');
  
  // Reorder level and supplier states
  const [reorderLevel, setReorderLevel] = useState('');
  const [suppliersList, setSuppliersList] = useState(getStoredSuppliers());
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  
  // Dynamic materials list and alert dialog state
  const [materialConfigs, setMaterialConfigs] = useState(getStoredMaterialConfigs());
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState(false);
  const [pendingMaterialData, setPendingMaterialData] = useState(null);
  
  // Get existing SKUs from inventory
  const existingSKUs = inventory.map(item => item.sku);

  // Ensure a SKU is unique in the database (case-insensitive).
  // Strategy:
  // 1) Query for existing SKUs that start with the base SKU (case-insensitive).
  // 2) If none exist, return baseSku.
  // 3) Otherwise, find the next numeric suffix (01, 02, ...) that isn't taken and return
  //    the base truncated so the suffix still fits within the 18-char limit.
  const makeSkuUnique = async (baseSku) => {
    if (!supabaseAdmin || !baseSku) return baseSku;
    const MAX_BATCH = 999;
    const maxLen = 18;

    try {
      // Fetch existing SKUs that start with the base (case-insensitive) from both tables.
      const { data: dataInv, error: errInv } = await supabaseAdmin
        .from('inventory')
        .select('sku')
        .ilike('sku', `${baseSku}%`)
        .limit(1000);

      const { data: dataCat, error: errCat } = await supabaseAdmin
        .from('inventory_catalog')
        .select('sku')
        .ilike('sku', `${baseSku}%`)
        .limit(1000);

      if (errInv) console.warn('Error checking SKU uniqueness in inventory:', errInv);
      if (errCat) console.warn('Error checking SKU uniqueness in inventory_catalog:', errCat);

      const existingSet = new Set([
        ...((dataInv || []).map(r => (r.sku || '').toUpperCase())),
        ...((dataCat || []).map(r => (r.sku || '').toUpperCase()))
      ]);
      const baseUpper = baseSku.toUpperCase();

      // If there are no existing SKUs that start with the base SKU, use baseSku as-is
      const hasPrefix = [...existingSet].some(s => s.startsWith(baseUpper));
      if (!hasPrefix) return baseUpper;

      // Otherwise try numeric suffixes (01, 02, ...) and return the first available.
      for (let i = 1; i <= MAX_BATCH; i++) {
        const suffix = String(i).padStart(2, '0');
        const basePart = baseUpper.slice(0, Math.max(0, maxLen - suffix.length));
        const candidate = `${basePart}${suffix}`;
        if (!existingSet.has(candidate)) return candidate;
      }

      // As a last resort, append a trimmed timestamp to make it unique (still respect maxLen)
      const ts = String(Date.now()).slice(-6);
      const basePart = baseUpper.slice(0, Math.max(0, maxLen - ts.length));
      return `${basePart}${ts}`;
    } catch (e) {
      console.error('Unexpected error while ensuring SKU uniqueness:', e);
      return baseSku;
    }
  };

  /* --- START: Added limiter logic (max 1000) --- */
  const MAX_LIMIT = 1000;

  const clampToMax = (val) => {
    if (val === '' || val === null || val === undefined) return val;
    const n = Number(val);
    if (Number.isNaN(n)) return val;
    if (n > MAX_LIMIT) return String(MAX_LIMIT);
    if (n < 0) return String(0);
    return String(val);
  };

  // Set the native input max attributes (useful if Input passes id through to <input>)
  useEffect(() => {
    const qtyInput = document.getElementById('quantity');
    const reorderInput = document.getElementById('reorder-level');
    if (qtyInput) qtyInput.setAttribute('max', String(MAX_LIMIT));
    if (reorderInput) reorderInput.setAttribute('max', String(MAX_LIMIT));
  }, []);

  // Watch quantity state and clamp to MAX_LIMIT with user feedback.
  useEffect(() => {
    if (quantity === '') return;
    const clamped = clampToMax(quantity);
    if (clamped !== quantity) {
      toast.error(`Quantity cannot exceed ${MAX_LIMIT}. It has been set to ${MAX_LIMIT}.`);
      setQuantity(clamped);
    }
  }, [quantity]);

  // Watch reorder level state and clamp to MAX_LIMIT with user feedback.
  useEffect(() => {
    if (reorderLevel === '') return;
    const clamped = clampToMax(reorderLevel);
    if (clamped !== reorderLevel) {
      toast.error(`Reorder level cannot exceed ${MAX_LIMIT}. It has been set to ${MAX_LIMIT}.`);
      setReorderLevel(clamped);
    }
  }, [reorderLevel]);
  /* --- END: Added limiter logic --- */

  useEffect(() => {
    if (material && supplier) {
      // For custom materials, use the display name as the material name for SKU
      const materialForSKU = isCustomMaterial() ? (getCurrentMaterialConfig()?.displayName || material) : material;
      const otherNameForSKU = isCustomMaterial() ? (getCurrentMaterialConfig()?.displayName || material) : otherMaterialName;
      
      const autoSku = generateSKU(
        materialForSKU, 
        subOption, 
        supplier, 
        shirtType, 
        shirtSize, 
        shirtColor, 
        existingSKUs,
        otherNameForSKU,
        otherSize,
        otherType,
        otherUnit,
        isCustomMaterial()
      );
      setGeneratedSKU(autoSku);
      setSku(autoSku);
    } else {
      setGeneratedSKU('');
      setSku('');
    }
  }, [material, subOption, supplier, shirtType, shirtSize, shirtColor, existingSKUs, otherMaterialName, otherSize, otherType, otherUnit]);

  // Clear all input fields and set default reorder level when material changes
  useEffect(() => {
    if (material) {
      const config = getCurrentMaterialConfig();
      
      // Clear all input fields
      setQuantity('');
      setNote('');
      setSupplier('');
      setSku('');
      setGeneratedSKU('');
      setSubOption('');
      setShirtType('');
      setShirtSize('');
      setShirtColor('');
      
      if (config) {
        // Set reorder level
        setReorderLevel((config.defaultReorderLevel || 10).toString());
        
        // If it's a custom material, restore its configuration
        if (config.type === 'custom') {
          setOtherMaterialName(config.displayName);
          setOtherSize(config.defaultSize || '');
          setOtherType(config.defaultType || '');
          setOtherUnit(config.defaultUnit || '');
        } else {
          // Clear other material fields for non-custom materials
          if (material !== 'others') {
            setOtherMaterialName('');
            setOtherSize('');
            setOtherType('');
            setOtherUnit('');
          }
        }
      } else if (material === 'others') {
        setReorderLevel('10'); // Default for new others
        setOtherMaterialName('');
        setOtherSize('');
        setOtherType('');
        setOtherUnit('');
      }
    }
  }, [material, materialConfigs]);
  
  // Check if current material is a custom type
  const isCustomMaterial = () => {
    const config = getCurrentMaterialConfig();
    return config?.type === 'custom';
  };

  // Save to localStorage
  const saveSuppliers = (suppliers) => {
    try {
      localStorage.setItem('shobe-suppliers', JSON.stringify(suppliers));
    } catch (error) {
      console.error('Failed to save suppliers:', error);
    }
  };

  const saveMaterialConfigs = (configs) => {
    try {
      localStorage.setItem('shobe-material-configs', JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save material configs:', error);
    }
  };

  const getDefaultReorderLevel = (material) => {
    const config = materialConfigs.find(c => c.name.toLowerCase() === material.toLowerCase());
    return config?.defaultReorderLevel || 10;
  };

  const getCurrentMaterialConfig = () => {
    return materialConfigs.find(c => c.name.toLowerCase() === material.toLowerCase()) || null;
  };

  const checkIsLengthMaterial = () => {
    if ((material === 'others' || isCustomMaterial()) && otherUnit.toLowerCase().includes('ft')) return true;
    const config = getCurrentMaterialConfig();
    return config?.isLengthMaterial || false;
  };

  const checkRequiresSubOption = () => {
    if (material === 'others') return false;
    const config = getCurrentMaterialConfig();
    return config?.requiresSubOption || false;
  };

  const validateSKU = (value) => {
    return /^[A-Z0-9]{8,18}$/.test(value);
  };

  const handleAddToInventory = () => {
    // Validate Others material fields
    if (material === 'others') {
      if (!otherMaterialName || !otherUnit) {
        toast.error('Please enter material name and unit');
        return;
      }
    } else if (isCustomMaterial()) {
      // For custom materials, validate unit
      if (!otherUnit) {
        toast.error('Unit is required for this material');
        return;
      }
    } else if (material === 'round neck shirt') {
      if (!shirtType || !shirtColor || !shirtSize) {
        toast.error('Please select shirt type, color, and size');
        return;
      }
    } else if (checkRequiresSubOption() && !subOption) {
      const config = getCurrentMaterialConfig();
      const optionType = config?.subOptionType || 'option';
      toast.error(`Please select ${optionType}`);
      return;
    }

    if (!material || !quantity || !supplier || !reorderLevel) {
      toast.error('Please select material, supplier, enter quantity and reorder level');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const reorderLvl = parseInt(reorderLevel);
    if (isNaN(reorderLvl) || reorderLvl < 0) {
      toast.error('Reorder level must be 0 or greater');
      return;
    }

    const skuUpper = sku.toUpperCase();
    if (!validateSKU(skuUpper)) {
      toast.error('SKU must be 8 to 18 alphanumeric characters.');
      return;
    }

    if (existingSKUs.includes(skuUpper)) {
      // Don't block the user — we'll make the SKU unique at insert time by appending
      // a supplier-aware batch suffix if needed. Inform the user that uniqueness will be enforced.
      toast.info('SKU already exists locally — a unique supplier-based SKU will be generated automatically.')
      // continue
    }

    // Determine final material base name, sizeValue and unit (store size separately)
    let finalMaterial = '';
    let sizeValue = '';
    let unit = '';

    if (material === 'others') {
      // Base name and unit come from the "other" inputs
      finalMaterial = otherMaterialName;
      unit = otherUnit;
      if (otherSize) {
        // Normalize measured sizes (remove extra spaces)
        sizeValue = otherSize.toLowerCase().replace(/\s+/g, '');
      }
    } else if (isCustomMaterial()) {
      const config = getCurrentMaterialConfig();
      finalMaterial = config?.displayName || otherMaterialName || material;
      unit = otherUnit || config?.defaultUnit || '';
      if (otherSize) sizeValue = otherSize.toLowerCase().replace(/\s+/g, '');
    } else if (material === 'round neck shirt') {
      finalMaterial = 'Round neck shirt';
      sizeValue = shirtSize;
      unit = 'pieces';
    } else {
      finalMaterial = checkRequiresSubOption() ? subOption : material;
      const config = getCurrentMaterialConfig();
      unit = config?.defaultUnit || (checkIsLengthMaterial() ? 'ft' : 'units');
    }
    
    const isNewRoll = checkIsLengthMaterial();
    const finalNote = note ? `${supplier} - ${note}` : supplier;

    // Store pending data for potential material addition
    if (material === 'others') {
      setPendingMaterialData({
        finalMaterial,
        size: sizeValue,
        qty,
        finalNote,
        isNewRoll,
        skuUpper,
        unit,
        reorderLvl,
        newMaterial: otherMaterialName
      });
      setShowAddMaterialDialog(true);
    } else {
      // Add directly for existing materials (including custom)
      addToInventoryFinal(finalMaterial, sizeValue, qty, finalNote, isNewRoll, skuUpper, unit, reorderLvl);
    }
  };

  const addToInventoryFinal = async (finalMaterial, sizeValue, qty, finalNote, isNewRoll, skuUpper, unit, reorderLvl) => {
    try {
      // Check if supplier is new and add to list
      if (supplier && !suppliersList.some(s => s.name.toLowerCase() === supplier.toLowerCase())) {
        const newSupplier = {
          name: supplier,
          dateAdded: new Date().toISOString().split('T')[0],
          isCustom: true
        };
        const updatedSuppliers = [...suppliersList, newSupplier];
        setSuppliersList(updatedSuppliers);
        saveSuppliers(updatedSuppliers);
      }

      // Prepare material config data
      const materialConfig = {
        original_material: material,
        is_custom: isCustomMaterial(),
        sub_option: subOption || null,
        shirt_type: shirtType || null,
        shirt_size: shirtSize || null,
        shirt_color: shirtColor || null,
        other_size: otherSize || null,
        other_type: otherType || null
      };

      // Get the display name from material configs or use material name
      const displayName = material === 'others'
        ? otherMaterialName
        : materialConfigs.find(c => c.name === material)?.displayName || material;

      // Use sizeValue passed from caller (already normalized)

  // Build name to include size/type/sub-option so InventoryOverview can display them
  // Prefer readable values from subOption, otherSize, otherType, or fallback to normalized sizeValue
  const parts = [];
  if (subOption) parts.push(subOption);
  if (otherSize) parts.push(otherSize);
  if (otherType) parts.push(otherType);
  // sizeValue is normalized; include it only if no nicer original values exist
  if (sizeValue && parts.length === 0) parts.push(sizeValue);

  const nameWithSize = parts.length ? `${displayName} - ${parts.join(' ')}` : displayName;
      // Ensure SKU is unique in DB across both tables (this will append numeric suffixes if necessary)
      const uniqueSku = await makeSkuUnique(skuUpper);

      // Build payload for both tables
      const payload = {
        name: nameWithSize,
        quantity: qty,
        unit: unit,
        reorder_level: reorderLvl,
        status: qty <= reorderLvl ? (qty === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock',
        is_new: true,
        sku: uniqueSku,
        supplier: supplier,
        note: finalNote,
        material_config: materialConfig,
        custom_material: material === 'others',
        created_by: currentUser.id
      };

      // Insert into inventory first
      const { data: invData, error: invError } = await supabaseAdmin
        .from('inventory')
        .insert(payload)
        .select()
        .single();

      if (invError) throw invError;


      // Then insert into inventory_catalog. If this fails, delete the inserted inventory row to keep consistency.
      const { data: catData, error: catError } = await supabaseAdmin
        .from('inventory_catalog')
        .insert(payload)
        .select()
        .single();

      if (catError) {
        // Attempt to rollback the inventory insert
        try {
          if (invData && invData.id) {
            await supabaseAdmin.from('inventory').delete().eq('id', invData.id);
          }
        } catch (delErr) {
          console.error('Failed to rollback inventory insert after catalog insert failure:', delErr);
        }
        throw catError;
      }

      // Ensure inventory row references the catalog entry via catalog_id for easy lookups later
      try {
        if (invData && invData.id && catData && catData.id) {
          // Update inventory.catalog_id
          const { error: invUpdateErr } = await supabaseAdmin
            .from('inventory')
            .update({ catalog_id: catData.id })
            .eq('id', invData.id)

          if (invUpdateErr) console.warn('Failed to set catalog_id on inventory row:', invUpdateErr)

          // If inventory_catalog has a catalog_id column and it's null, set it to its own id for consistency
          try {
            const { data: icRow, error: icFetchErr } = await supabaseAdmin
              .from('inventory_catalog')
              .select('catalog_id')
              .eq('id', catData.id)
              .single()
            if (!icFetchErr && icRow && (icRow.catalog_id === null || icRow.catalog_id === undefined)) {
              const { error: icUpdateErr } = await supabaseAdmin
                .from('inventory_catalog')
                .update({ catalog_id: catData.id })
                .eq('id', catData.id)
              if (icUpdateErr) console.warn('Failed to set catalog_id on inventory_catalog row:', icUpdateErr)
            }
          } catch (e) {
            console.warn('Error checking/updating inventory_catalog.catalog_id:', e)
          }
        }
      } catch (e) {
        console.warn('Error setting catalog_id references after insert:', e)
      }

      // Record the transaction (pointing to the inventory row id) and include catalog_id when available
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          catalog_id: catData?.id || null,
          type: 'Added',
          quantity: qty,
          note: finalNote,
          user_id: currentUser.id,
          username: currentUser.username
        });

      if (transactionError) throw transactionError;

      toast.success(`Added ${qty} ${unit} of ${finalMaterial} to inventory (SKU: ${invData?.sku || uniqueSku})`);
      resetForm();
    } catch (error) {
      // Provide more helpful debug info both in console and UI so we can see why Supabase rejected the insert
      console.error('Error adding stock:', error);
      // If the error came from Supabase it may contain a message or details
      const errMsg = error?.message || (error?.error?.message) || JSON.stringify(error);
      toast.error(`Failed to add stock: ${errMsg}`);
      // Re-throw to allow upstream handlers (if awaited) to react as well
      throw error;
    }
  };

  const resetForm = () => {
    setMaterial('');
    setSubOption('');
    setQuantity('');
    setSupplier('');
    setNote('');
    setSku('');
    setGeneratedSKU('');
    setReorderLevel('');
    setShirtType('');
    setShirtColor('');
    setShirtSize('');
    setOtherMaterialName('');
    setOtherSize('');
    setOtherType('');
    setOtherUnit('');
  };

  const handleAddMaterialConfirm = async () => {
    if (pendingMaterialData) {
      try {
        // Create new material config
        const newMaterialConfig = {
          name: pendingMaterialData.newMaterial.toLowerCase(),
          displayName: pendingMaterialData.newMaterial,
          type: 'custom',
          defaultSize: otherSize || undefined,
          defaultType: otherType || undefined,
          defaultUnit: otherUnit,
          isLengthMaterial: otherUnit.toLowerCase().includes('ft'),
          defaultReorderLevel: pendingMaterialData.reorderLvl
        };
        
        // Add to materials config list
        const updatedConfigs = [...materialConfigs, newMaterialConfig];
        setMaterialConfigs(updatedConfigs);
        saveMaterialConfigs(updatedConfigs);
        
        // Add to inventory
        await addToInventoryFinal(
          pendingMaterialData.finalMaterial,
          pendingMaterialData.size || '',
          pendingMaterialData.qty,
          pendingMaterialData.finalNote,
          pendingMaterialData.isNewRoll,
          pendingMaterialData.skuUpper,
          pendingMaterialData.unit,
          pendingMaterialData.reorderLvl
        );
        
        setShowAddMaterialDialog(false);
        setPendingMaterialData(null);
      } catch (error) {
        console.error('Error adding material:', error);
        toast.error('Failed to add material and stock');
      }
    }
  };

  const handleAddMaterialCancel = async () => {
    if (pendingMaterialData) {
      try {
        // Just add to inventory without updating materials list
        await addToInventoryFinal(
          pendingMaterialData.finalMaterial,
          pendingMaterialData.size || '',
          pendingMaterialData.qty,
          pendingMaterialData.finalNote,
          pendingMaterialData.isNewRoll,
          pendingMaterialData.skuUpper,
          pendingMaterialData.unit,
          pendingMaterialData.reorderLvl
        );
        
        setShowAddMaterialDialog(false);
        setPendingMaterialData(null);
      } catch (error) {
        console.error('Error adding stock:', error);
        toast.error('Failed to add stock');
      }
    }
  };

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader title="Add Stock (Admin)" currentUser={currentUser} onLogout={onLogout} showNotifications={true} lowStockItems={lowStockItems} onNavigateToAccount={onNavigateToAccount} />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-lg mx-auto space-y-6 py-4">
          
          {/* Material Selection */}
          <div className="space-y-2">
            <Label htmlFor="material">Material</Label>
            <Select value={material} onValueChange={(value) => { 
              setMaterial(value); 
              setSubOption(''); 
              setShirtType(''); 
              setShirtColor(''); 
              setShirtSize('');
              setOtherMaterialName('');
              setOtherSize('');
              setOtherType('');
              setOtherUnit('');
              // Reorder level will be set by useEffect
            }}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {materialConfigs.map((config) => (
                  <SelectItem key={config.name} value={config.name}>
                    {config.displayName}
                  </SelectItem>
                ))}
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-options */}
          {checkRequiresSubOption() && (
            <div className="space-y-2">
              <Label htmlFor="sub-option">{getCurrentMaterialConfig()?.subOptionType || 'Option'}</Label>
              <Select value={subOption} onValueChange={setSubOption}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={`Select ${getCurrentMaterialConfig()?.subOptionType || 'option'}`} />
                </SelectTrigger>
                <SelectContent>
                  {getCurrentMaterialConfig()?.subOptions?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Round neck shirt options */}
          {material === 'round neck shirt' && (
            <>
              {/* Shirt Type */}
              <div className="space-y-2">
                <Label htmlFor="shirt-type">Type</Label>
                <Select value={shirtType} onValueChange={(value) => { 
                  setShirtType(value); 
                  setShirtColor(''); 
                  setShirtSize(''); 
                }}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select shirt type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cotton">Cotton</SelectItem>
                    <SelectItem value="Dri-FIT">Dri-FIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Shirt Color (depends on type) */}
              {shirtType && (
                <div className="space-y-2">
                  <Label htmlFor="shirt-color">Color</Label>
                  <Select value={shirtColor} onValueChange={setShirtColor}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {shirtType === 'Cotton' ? (
                        <>
                          <SelectItem value="Light Yellow">Light Yellow</SelectItem>
                          <SelectItem value="Red">Red</SelectItem>
                          <SelectItem value="Royal Blue">Royal Blue</SelectItem>
                          <SelectItem value="Emerald Green">Emerald Green</SelectItem>
                          <SelectItem value="Yellow Gold">Yellow Gold</SelectItem>
                          <SelectItem value="Maroon">Maroon</SelectItem>
                          <SelectItem value="Apple Green">Apple Green</SelectItem>
                          <SelectItem value="Sunkist">Sunkist</SelectItem>
                          <SelectItem value="Orange">Orange</SelectItem>
                          <SelectItem value="Teal Green">Teal Green</SelectItem>
                          <SelectItem value="Avocado">Avocado</SelectItem>
                          <SelectItem value="Fuschia">Fuschia</SelectItem>
                          <SelectItem value="Magenta">Magenta</SelectItem>
                          <SelectItem value="Muroise">Muroise</SelectItem>
                          <SelectItem value="Aqua Blue">Aqua Blue</SelectItem>
                          <SelectItem value="Aqua Marine">Aqua Marine</SelectItem>
                          <SelectItem value="Navy Blue">Navy Blue</SelectItem>
                          <SelectItem value="Acid Gray">Acid Gray</SelectItem>
                          <SelectItem value="White">White</SelectItem>
                          <SelectItem value="Mint Green">Mint Green</SelectItem>
                          <SelectItem value="Flesh">Flesh</SelectItem>
                          <SelectItem value="Light Blue">Light Blue</SelectItem>
                          <SelectItem value="Gray">Gray</SelectItem>
                          <SelectItem value="Peach">Peach</SelectItem>
                          <SelectItem value="Light Pink">Light Pink</SelectItem>
                          <SelectItem value="Lavender">Lavender</SelectItem>
                          <SelectItem value="Violet">Violet</SelectItem>
                          <SelectItem value="Deep Cobalt">Deep Cobalt</SelectItem>
                          <SelectItem value="Acid Blue">Acid Blue</SelectItem>
                          <SelectItem value="Cayenne">Cayenne</SelectItem>
                          <SelectItem value="Lyson Blue">Lyson Blue</SelectItem>
                          <SelectItem value="Black">Black</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="White">White</SelectItem>
                          <SelectItem value="Yellow Gold">Yellow Gold</SelectItem>
                          <SelectItem value="Gray">Gray</SelectItem>
                          <SelectItem value="Light Blue">Light Blue</SelectItem>
                          <SelectItem value="Neon Orange">Neon Orange</SelectItem>
                          <SelectItem value="Neon Green">Neon Green</SelectItem>
                          <SelectItem value="Royal Blue">Royal Blue</SelectItem>
                          <SelectItem value="Army Green">Army Green</SelectItem>
                          <SelectItem value="Black">Black</SelectItem>
                          <SelectItem value="Maroon">Maroon</SelectItem>
                          <SelectItem value="Navy Blue">Navy Blue</SelectItem>
                          <SelectItem value="Red">Red</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Shirt Size (depends on type) */}
              {shirtType && (
                <div className="space-y-2">
                  <Label htmlFor="shirt-size">Size</Label>
                  <Select value={shirtSize} onValueChange={setShirtSize}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {shirtType === 'Cotton' ? (
                        <>
                          <SelectItem value="Size 8">Size 8</SelectItem>
                          <SelectItem value="Size 10">Size 10</SelectItem>
                          <SelectItem value="Size 12">Size 12</SelectItem>
                          <SelectItem value="Size 14">Size 14</SelectItem>
                          <SelectItem value="Size 16">Size 16</SelectItem>
                          <SelectItem value="Size 18">Size 18</SelectItem>
                          <SelectItem value="XS">XS</SelectItem>
                          <SelectItem value="Small">Small</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Large">Large</SelectItem>
                          <SelectItem value="XL">XL</SelectItem>
                          <SelectItem value="XXL">XXL</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="XS">XS</SelectItem>
                          <SelectItem value="Small">Small</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Large">Large</SelectItem>
                          <SelectItem value="XL">XL</SelectItem>
                          <SelectItem value="XXL">XXL</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Others material fields or Custom material fields */}
          {(material === 'others' || isCustomMaterial()) && (
            <>
              {/* Material Name - only show for "others", not for custom materials */}
              {material === 'others' && (
                <div className="space-y-2">
                  <Label htmlFor="other-material-name">Name of Material</Label>
                  <Input
                    id="other-material-name"
                    type="text"
                    placeholder="Enter material name"
                    value={otherMaterialName}
                    onChange={(e) => setOtherMaterialName(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              )}

              {/* Size (optional) - show if it was previously saved or if it's "others" */}
              {(material === 'others' || (isCustomMaterial() && getCurrentMaterialConfig()?.defaultSize !== undefined)) && (
                <div className="space-y-2">
                  <Label htmlFor="other-size">Size (optional)</Label>
                  <Input
                    id="other-size"
                    type="text"
                    placeholder="e.g., 4ft, A4, Large"
                    value={otherSize}
                    onChange={(e) => setOtherSize(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              )}

              {/* Type (optional) - show if it was previously saved or if it's "others" */}
              {(material === 'others' || (isCustomMaterial() && getCurrentMaterialConfig()?.defaultType !== undefined)) && (
                <div className="space-y-2">
                  <Label htmlFor="other-type">Type (optional)</Label>
                  <Input
                    id="other-type"
                    type="text"
                    placeholder="e.g., glossy, matte, premium"
                    value={otherType}
                    onChange={(e) => setOtherType(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              )}

              {/* Unit */}
              <div className="space-y-2">
                <Label htmlFor="other-unit">Unit</Label>
                <Select value={otherUnit} onValueChange={setOtherUnit} disabled={isCustomMaterial()}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="ft">Feet (ft)</SelectItem>
                    <SelectItem value="sheets">Sheets</SelectItem>
                    <SelectItem value="bottles">Bottles</SelectItem>
                    <SelectItem value="rolls">Rolls</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                    <SelectItem value="packs">Packs</SelectItem>
                    <SelectItem value="sets">Sets</SelectItem>
                    <SelectItem value="units">Units</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomMaterial() && (
                  <small className="text-gray-500">
                    Unit is pre-configured for this material
                  </small>
                )}
              </div>
            </>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {material === 'others' || isCustomMaterial() ? 'Quantity/Length' : checkIsLengthMaterial() ? 'Length' : 'Quantity'}
            </Label>
            <div className="relative">
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                placeholder={
                  material === 'others' || isCustomMaterial() ? 'Enter quantity or length' :
                  checkIsLengthMaterial() ? 'Enter length' : 'Enter quantity'
                }
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value
                  // Only allow positive numbers
                  if (value === '' || parseFloat(value) >= 0) {
                    setQuantity(value)
                  }
                }}
                className="h-12 text-base"
              />
              {checkIsLengthMaterial() && material !== 'others' && !isCustomMaterial() && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">ft</span>
                </div>
              )}
              {(material === 'others' || isCustomMaterial()) && otherUnit && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">{otherUnit}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="space-y-2 relative">
            <Label htmlFor="supplier">Supplier</Label>
            <div className="relative">
              <Input
                id="supplier"
                type="text"
                placeholder="Type or select supplier"
                value={supplier}
                onChange={(e) => {
                  setSupplier(e.target.value);
                  setShowSupplierDropdown(e.target.value.length > 0);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                onBlur={(e) => {
                  // Check if the related target (where focus is moving to) is within the dropdown
                  if (!e.relatedTarget || !e.currentTarget.parentElement?.contains(e.relatedTarget)) {
                    // Delay hiding to allow click on suggestion
                    setTimeout(() => setShowSupplierDropdown(false), 150);
                  }
                }}
                className="h-12 text-base"
              />
              {showSupplierDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {suppliersList
                    .filter(supplierConfig => 
                      supplierConfig.name.toLowerCase().includes(supplier.toLowerCase())
                    )
                    .map((supplierConfig) => (
                      <div
                        key={supplierConfig.name}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSupplier(supplierConfig.name);
                          setShowSupplierDropdown(false);
                        }}
                      >
                        {supplierConfig.name}
                      </div>
                    ))}
                  {supplier && !suppliersList.some(s => s.name.toLowerCase() === supplier.toLowerCase()) && (
                    <div
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-blue-600"
                      onClick={() => {
                        const newSupplier = {
                          name: supplier,
                          dateAdded: new Date().toISOString().split('T')[0],
                          isCustom: true
                        };
                        const updatedSuppliers = [...suppliersList, newSupplier];
                        setSuppliersList(updatedSuppliers);
                        saveSuppliers(updatedSuppliers);
                        setShowSupplierDropdown(false);
                        toast.success(`Added "${supplier}" to suppliers list`);
                      }}
                    >
                      Add "{supplier}" as new supplier
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reorder Level - only show for "others" material, not for custom materials */}
          {!isCustomMaterial() && (
            <div className="space-y-2">
              <Label htmlFor="reorder-level">Reorder Level (for notifications)</Label>
              <Input
                id="reorder-level"
                type="number"
                min="0"
                step="1"
                placeholder="Enter reorder level"
                value={reorderLevel}
                onChange={(e) => {
                  const value = e.target.value
                  // Only allow positive integers
                  if (value === '' || (parseInt(value) >= 0 && !value.includes('.'))) {
                    setReorderLevel(value)
                  }
                }}
                className="h-12 text-base"
              />
              <small className="text-gray-500">
                You'll be notified when stock falls to or below this level
              </small>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Additional Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="PO number, batch info, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[100px] text-base"
            />
          </div>

          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              type="text"
              value={sku}
              maxLength={24}
              onChange={(e) => {
                const newValue = e.target.value.toUpperCase()
                // Only allow changes if the new value starts with the generated SKU
                if (newValue.startsWith(generatedSKU) || newValue === '') {
                  setSku(newValue)
                }
              }}
              onKeyDown={(e) => {
                // Prevent backspace and delete if it would remove part of the generated SKU
                if ((e.key === 'Backspace' || e.key === 'Delete') && sku.length <= generatedSKU.length) {
                  e.preventDefault()
                }
              }}
              placeholder="SKU"
              className="font-mono h-12 text-base"
            />
            <small className="text-gray-500">Generated SKU: {generatedSKU}</small>
          </div>

          {/* Submit Button - positioned below the form */}
          <div className="pt-4">
            <Button
              onClick={handleAddToInventory}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
              disabled={
                !material || !quantity || !supplier || !reorderLevel ||
                (material === 'others' && (!otherMaterialName || !otherUnit)) ||
                (isCustomMaterial() && !otherUnit) ||
                (material === 'round neck shirt' && (!shirtType || !shirtColor || !shirtSize)) ||
                (checkRequiresSubOption() && material !== 'round neck shirt' && material !== 'others' && !isCustomMaterial() && !subOption)
              }
            >
              Add to Inventory
            </Button>
          </div>
        </div>
      </div>

      {/* Add Material Confirmation Dialog */}
      <AlertDialog open={showAddMaterialDialog} onOpenChange={setShowAddMaterialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Material to List?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to add "{otherMaterialName}" to the materials dropdown list for future use? 
              This will make it easier to select this material in the future.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleAddMaterialCancel}>
              No, just add to inventory
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddMaterialConfirm}>
              Yes, add to list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
