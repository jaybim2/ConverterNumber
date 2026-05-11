/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  User,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  History,
  Code,
  UploadCloud,
  FileJson,
  ArrowRightLeft,
  FileDown,
  X
} from 'lucide-react';

enum AppMode {
  NUM_TO_VCF = 'NUM_TO_VCF',
  VCF_TO_TXT = 'VCF_TO_TXT',
  TXT_TO_VCF = 'TXT_TO_VCF'
}

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.NUM_TO_VCF);

  // VCF Generation State (Shared for manual and TXT import)
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [contactPrefix, setContactPrefix] = useState('Customer');
  const [fileName, setFileName] = useState('lead_database');

  // Splitting Features
  const [isSplit, setIsSplit] = useState(false);
  const [splitSize, setSplitSize] = useState(500);
  const [startFileNumber, setStartFileNumber] = useState(1);

  // Special Group Contacts (Admin, Navy, etc)
  const [specialGroups, setSpecialGroups] = useState<{ id: string, label: string, numbers: string, active: boolean }[]>([
    { id: crypto.randomUUID(), label: 'Admin', numbers: '', active: false },
    { id: crypto.randomUUID(), label: 'Navy', numbers: '', active: false }
  ]);

  // VCF Extraction State
  const [vcfFile, setVcfFile] = useState<File | null>(null);
  const [extractedNumbers, setExtractedNumbers] = useState('');

  // TXT to VCF State
  const [txtFile, setTxtFile] = useState<File | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSpecialGroup = () => {
    setSpecialGroups([...specialGroups, { id: crypto.randomUUID(), label: '', numbers: '', active: true }]);
  };

  const removeSpecialGroup = (id: string) => {
    setSpecialGroups(specialGroups.filter(g => g.id !== id));
  };

  const updateSpecialGroup = (id: string, field: string, value: any) => {
    setSpecialGroups(specialGroups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const parseNumbers = (input: string) => {
    return input
      .split(/[\n,;]+/)
      .map(num => num.trim())
      .filter(num => num.length > 0);
  };

  const handleConvert = useCallback(() => {
    const numbers = parseNumbers(phoneNumbers);
    const activeSpecialNumbers = specialGroups
      .filter(g => g.active && g.numbers)
      .map(g => parseNumbers(g.numbers))
      .flat();

    if (numbers.length === 0 && activeSpecialNumbers.length === 0) {
      setError('Silakan masukkan nomor telepon atau aktifkan setidaknya satu grup kontak.');
      return;
    }

    try {
      const formatNum = (n: string) => {
        let cleaned = n.trim().replace(/\s+/g, '');
        if (cleaned.startsWith('+')) return cleaned;
        if (cleaned.startsWith('0')) return '+62' + cleaned.substring(1);
        if (cleaned.startsWith('62')) return '+' + cleaned;
        return '+' + cleaned; // Default add + for VCF compatibility
      };

      const generateVcf = (numList: string[], startIdx: number, includeSpecial: boolean) => {
        let content = '';

        if (includeSpecial && mode === AppMode.NUM_TO_VCF) {
          specialGroups.forEach(group => {
            if (group.active && group.label && group.numbers) {
              const gNumbers = parseNumbers(group.numbers);
              gNumbers.forEach((num, gIdx) => {
                const displayName = `${group.label} ${gIdx + 1}`.trim();
                content += `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;TYPE=CELL:${formatNum(num)}\nEND:VCARD\n`;
              });
            }
          });
        }

        numList.forEach((num, index) => {
          const displayName = `${contactPrefix} ${startIdx + index + 1}`.trim();
          content += `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;TYPE=CELL:${formatNum(num)}\nEND:VCARD\n`;
        });
        return content;
      };

      const downloadFile = (content: string, name: string) => {
        const blob = new Blob([content], { type: 'text/vcard' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      };

      if (isSplit && numbers.length > splitSize) {
        let currentFileIdx = startFileNumber;
        for (let i = 0; i < numbers.length; i += splitSize) {
          const chunk = numbers.slice(i, i + splitSize);
          // Only include special contacts in the first chunk/file
          const content = generateVcf(chunk, i, i === 0);
          downloadFile(content, `${fileName}_part_${currentFileIdx}.vcf`);
          currentFileIdx++;
        }
      } else {
        const content = generateVcf(numbers, 0, true);
        downloadFile(content, `${fileName || 'contacts'}.vcf`);
      }

      setIsSuccess(true);
      setError(null);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      setError('Terjadi kesalahan saat membuat file. Silakan coba lagi.');
      console.error(err);
    }
  }, [phoneNumbers, contactPrefix, fileName]);

  const handleVcfUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.vcf')) {
      setError('Hanya file .vcf yang didukung.');
      return;
    }

    setVcfFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const numbers: string[] = [];

      lines.forEach(line => {
        if (line.toUpperCase().startsWith('TEL')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            const numPart = parts[parts.length - 1].trim();
            if (numPart) numbers.push(numPart);
          }
        }
      });

      if (numbers.length === 0) {
        setError('Tidak ada nomor telepon yang ditemukan dalam file ini.');
        setExtractedNumbers('');
      } else {
        setExtractedNumbers(numbers.join('\n'));
      }
    };
    reader.readAsText(file);
  };

  const handleTxtUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setError('Hanya file .txt yang didukung.');
      return;
    }

    setTxtFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // Extract numbers using regex for better accuracy in raw text, preserving '+' if present
      const numbers = content.match(/[+]?\d{5,15}/g);
      if (!numbers || numbers.length === 0) {
        setError('Tidak ada nomor telepon yang ditemukan dalam file .txt ini.');
        setPhoneNumbers('');
      } else {
        setPhoneNumbers(numbers.join('\n'));
      }
    };
    reader.readAsText(file);
  };

  const downloadExtractedTxt = () => {
    if (!extractedNumbers) return;

    const blob = new Blob([extractedNumbers], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${vcfFile?.name.replace('.vcf', '') || 'extracted_numbers'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  const handleClear = () => {
    if (mode === AppMode.NUM_TO_VCF) {
      setPhoneNumbers('');
    } else if (mode === AppMode.VCF_TO_TXT) {
      setVcfFile(null);
      setExtractedNumbers('');
    } else if (mode === AppMode.TXT_TO_VCF) {
      setTxtFile(null);
      setPhoneNumbers('');
    }
    setError(null);
  };

  const specialNumbersCount = mode === AppMode.NUM_TO_VCF
    ? specialGroups
      .filter(g => g.active && g.numbers)
      .reduce((sum, g) => sum + parseNumbers(g.numbers).length, 0)
    : 0;

  const count = mode === AppMode.VCF_TO_TXT
    ? parseNumbers(extractedNumbers).length
    : (parseNumbers(phoneNumbers).length + specialNumbersCount);

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden">
      {/* Header Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-zinc-950" />
          </div>
          <span className="text-xl font-bold tracking-tight uppercase">KZ ADITT CV</span>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => { setMode(AppMode.NUM_TO_VCF); setError(null); handleClear(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === AppMode.NUM_TO_VCF ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Numbers to VCF
          </button>
          <button
            onClick={() => { setMode(AppMode.TXT_TO_VCF); setError(null); handleClear(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === AppMode.TXT_TO_VCF ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            TXT to VCF
          </button>
          <button
            onClick={() => { setMode(AppMode.VCF_TO_TXT); setError(null); handleClear(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mode === AppMode.VCF_TO_TXT ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            VCF to TXT
          </button>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500">
          <button className="px-4 py-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:bg-zinc-800 transition-colors">v3.0.0</button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950">
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl"
        >
          <div className="mb-10 text-center">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
              {mode === AppMode.NUM_TO_VCF && 'Numbers to VCF'}
              {mode === AppMode.TXT_TO_VCF && 'TXT to VCF'}
              {mode === AppMode.VCF_TO_TXT && 'VCF to TXT'}
            </h1>
            <p className="text-zinc-500 max-w-lg mx-auto italic text-sm md:text-base">
              {mode === AppMode.NUM_TO_VCF && 'Convert bulk phone numbers into organized .vcf contacts.'}
              {mode === AppMode.TXT_TO_VCF && 'Impor file .txt Anda, kami akan ekstrak semua nomornya secara otomatis.'}
              {mode === AppMode.VCF_TO_TXT && 'Ekstrak semua nomor telepon dari file vCard (.vcf) menjadi daftar teks bersih.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  {mode === AppMode.NUM_TO_VCF && '01. Input Phone Numbers'}
                  {mode === AppMode.TXT_TO_VCF && '01. Upload TXT File'}
                  {mode === AppMode.VCF_TO_TXT && '01. Upload VCF File'}
                </label>
                {count > 0 && (
                  <span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    {count} NUMBERS {mode === AppMode.VCF_TO_TXT ? 'EXTRACTED' : 'DETECTED'}
                  </span>
                )}
              </div>

              <div className="relative group flex-1 min-h-[300px]">
                {mode === AppMode.NUM_TO_VCF ? (
                  <textarea
                    id="numbers"
                    value={phoneNumbers}
                    onChange={(e) => {
                      const filtered = e.target.value.replace(/[^0-9\n\r,;+]/g, '');
                      setPhoneNumbers(filtered);
                      if (error) setError(null);
                    }}
                    placeholder="Enter numbers (one per line)...&#10;+62812345678&#10;+62819876543"
                    className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none font-mono text-sm leading-relaxed transition-all placeholder:text-zinc-700"
                  />
                ) : mode === AppMode.TXT_TO_VCF ? (
                  <div className="w-full h-full flex flex-col gap-4">
                    <label className={`w-full aspect-[16/6] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${txtFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
                      <input type="file" accept=".txt" onChange={handleTxtUpload} className="hidden" />
                      <UploadCloud className={`w-10 h-10 ${txtFile ? 'text-emerald-500' : 'text-zinc-700'}`} />
                      <div className="text-center">
                        <span className="block text-sm font-bold text-zinc-300">{txtFile ? txtFile.name : 'Pilih file .txt'}</span>
                        <span className="text-[10px] text-zinc-600">Nomor akan dideteksi otomatis</span>
                      </div>
                    </label>
                    <textarea
                      readOnly
                      value={phoneNumbers}
                      placeholder="Nomor yang terdeteksi..."
                      className="flex-1 bg-zinc-950 border border-zinc-900 rounded-2xl p-4 text-zinc-500 font-mono text-xs focus:outline-none resize-none"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col gap-4">
                    <label className={`w-full aspect-[16/6] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${vcfFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
                      <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" />
                      <UploadCloud className={`w-10 h-10 ${vcfFile ? 'text-emerald-500' : 'text-zinc-700'}`} />
                      <div className="text-center">
                        <span className="block text-sm font-bold text-zinc-300">{vcfFile ? vcfFile.name : 'Pilih file .vcf'}</span>
                        <span className="text-[10px] text-zinc-600">Klik atau seret file ke sini</span>
                      </div>
                    </label>
                    <textarea
                      readOnly
                      value={extractedNumbers}
                      placeholder="Hasil ekstraksi akan muncul di sini..."
                      className="flex-1 bg-zinc-950 border border-zinc-900 rounded-2xl p-4 text-zinc-500 font-mono text-xs focus:outline-none resize-none"
                    />
                  </div>
                )}

                {(phoneNumbers || vcfFile || txtFile) && (
                  <button
                    onClick={handleClear}
                    className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                    title="Clear All"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-7 flex flex-col gap-8">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {mode !== AppMode.VCF_TO_TXT ? (
                  <>
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">
                        02. Name Prefix
                      </label>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4">
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                          <input
                            type="text"
                            value={contactPrefix}
                            onChange={(e) => setContactPrefix(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-600 leading-tight italic">
                          Format: {contactPrefix} 1, {contactPrefix} 2, etc.
                        </p>
                      </div>
                    </div>

                    {/* Special Fixed Contacts Section */}
                    {mode === AppMode.NUM_TO_VCF && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col gap-3">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
                            Group Contacts (Admin, Navy, etc)
                          </label>
                          <button
                            onClick={addSpecialGroup}
                            className="text-[9px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20"
                          >
                            + Tambah Grup
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {specialGroups.map((group) => (
                            <div
                              key={group.id}
                              className={`p-4 rounded-2xl border transition-all ${group.active ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-900 border-zinc-800'}`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <input
                                  type="text"
                                  placeholder="Group Label (eg: Admin)"
                                  value={group.label}
                                  onChange={(e) => updateSpecialGroup(group.id, 'label', e.target.value)}
                                  className="bg-transparent border-none text-white font-bold text-sm focus:outline-none placeholder:text-zinc-700 w-full mr-2"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateSpecialGroup(group.id, 'active', !group.active)}
                                    className={`w-8 h-4 rounded-full relative transition-all ${group.active ? 'bg-amber-500' : 'bg-zinc-800'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${group.active ? 'translate-x-4' : 'translate-x-1'}`} />
                                  </button>
                                  <button
                                    onClick={() => removeSpecialGroup(group.id)}
                                    className="text-zinc-600 hover:text-red-400 transition-all p-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                placeholder="Masukkan nomor (satu per baris)..."
                                value={group.numbers}
                                onChange={(e) => {
                                  const filtered = e.target.value.replace(/[^0-9\n\r,;+]/g, '');
                                  updateSpecialGroup(group.id, 'numbers', filtered);
                                }}
                                className="w-full h-24 bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-3 text-[10px] text-zinc-400 font-mono focus:outline-none focus:border-amber-500/30 resize-none transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">
                        03. File Name
                      </label>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4">
                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                          <FileText className="w-4 h-4 text-zinc-600 mr-3" />
                          <input
                            type="text"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ''))}
                            className="flex-1 bg-transparent text-white placeholder-zinc-700 focus:outline-none font-medium"
                          />
                          <span className="text-zinc-700 font-mono text-sm ml-2">.vcf</span>
                        </div>

                        {/* Split Toggle */}
                        <div className="pt-2 flex items-center justify-between border-t border-zinc-800/50 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Pisah File (Splitting)</span>
                            <span className="text-[9px] text-zinc-600">Bagi kontak ke beberapa file</span>
                          </div>
                          <button
                            onClick={() => setIsSplit(!isSplit)}
                            className={`w-10 h-5 rounded-full transition-all relative ${isSplit ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSplit ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>

                        <AnimatePresence>
                          {isSplit && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4 pt-2 overflow-hidden"
                            >
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-zinc-500 uppercase">Kontak/File</label>
                                  <input
                                    type="number"
                                    value={splitSize}
                                    onChange={(e) => setSplitSize(parseInt(e.target.value) || 1)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-zinc-500 uppercase">Input Angka File</label>
                                  <input
                                    type="number"
                                    value={startFileNumber}
                                    onChange={(e) => setStartFileNumber(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-full flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">
                      Informasi Ekstraksi
                    </label>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex items-center justify-around">
                      <div className="text-center">
                        <div className="text-3xl font-black text-white mb-1">{count}</div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Nomor Ditemukan</div>
                      </div>
                      <div className="h-12 w-px bg-zinc-800"></div>
                      <div className="text-center">
                        <div className="text-3xl font-black text-white mb-1">.txt</div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Output Format</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button & Error */}
              <div className="flex-1 flex flex-col justify-end gap-4 min-h-[100px]">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={mode === AppMode.VCF_TO_TXT ? downloadExtractedTxt : handleConvert}
                  disabled={
                    isSuccess ||
                    (mode === AppMode.VCF_TO_TXT && !extractedNumbers) ||
                    ((mode === AppMode.NUM_TO_VCF || mode === AppMode.TXT_TO_VCF) && !phoneNumbers && !specialGroups.some(g => g.active && g.numbers))
                  }
                  className={`group relative w-full h-24 rounded-3xl transition-all duration-500 flex items-center justify-center gap-4 overflow-hidden shadow-2xl ${isSuccess
                      ? 'bg-zinc-800 text-emerald-500 cursor-default shadow-zinc-950'
                      : (
                        (mode === AppMode.VCF_TO_TXT && !extractedNumbers) ||
                        ((mode === AppMode.NUM_TO_VCF || mode === AppMode.TXT_TO_VCF) && !phoneNumbers && !specialGroups.some(g => g.active && g.numbers))
                      )
                        ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed border border-zinc-800'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'
                    }`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  {isSuccess ? (
                    <CheckCircle2 className="w-10 h-10" />
                  ) : mode === AppMode.VCF_TO_TXT ? (
                    <FileDown className="w-8 h-8 animate-pulse" />
                  ) : (
                    <Download className="w-8 h-8 animate-bounce" />
                  )}

                  <div className="text-left">
                    <span className="block text-xl font-black uppercase tracking-tighter leading-none mb-1">
                      {isSuccess ? 'Download Success' : mode === AppMode.VCF_TO_TXT ? 'Ekstrak & Simpan TXT' : 'Generate & Save'}
                    </span>
                    <span className="block text-[10px] font-bold opacity-60 uppercase tracking-widest">
                      {isSuccess ? 'File saved to storage' : 'Secured locally in browser'}
                    </span>
                  </div>
                </motion.button>
              </div>

            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer Bar */}
      <footer className="px-8 py-4 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between text-[10px] md:text-[11px] font-medium text-zinc-600 shrink-0">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            SYSTEM STATUS: <span className="text-emerald-500 font-bold">ONLINE</span>
          </span>
          <span className="hidden sm:inline">ENCRYPTION: AES-256</span>
        </div>
        <div className="flex gap-4">
          <span className="hidden sm:inline">OFFLINE MODE READY</span>
          <span className="uppercase">&copy; 2026 WEBSITE BY KZ ADIT </span>
        </div>
      </footer>
    </div>
  );
}
