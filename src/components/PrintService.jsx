import { useState, useRef, useEffect } from "react";
import { Upload, FileText, X, Printer, Settings } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { toast } from "sonner";
import { supabaseAdmin } from "../lib/supabaseClient";

const PRINT_TRANSACTION_TYPE = "Print"; // change this if your transactions_type_check allows a different value

export function PrintService({
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount,
}) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const isStaff = currentUser?.role === "Staff";

  const [printSettings, setPrintSettings] = useState({
    copies: 1,
    paperSize: "letter",
    orientation: "portrait",
    colorMode: "color",
    duplex: "none",
  });

  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => {
        if (file.url) URL.revokeObjectURL(file.url);
      });
    };
  }, [uploadedFiles]);

  const isPrintablePdf = (file) => file?.type === "application/pdf";

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files) return;

    if (!isStaff) {
      toast.error("Only Staff members can upload and print documents.");
      return;
    }

    Array.from(files).forEach((file) => {
      const isSupported =
        file.type === "application/pdf" ||
        file.type === "application/msword" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (!isSupported) {
        toast.error(`${file.name} is not a supported file type.`);
        return;
      }

      const newFile = {
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        type: file.type,
        size: file.size,
        file,
        url: URL.createObjectURL(file),
      };

      setUploadedFiles((prev) => [...prev, newFile]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (id) => {
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((file) => file.id !== id);
    });

    if (selectedFile?.id === id) {
      setSelectedFile(null);
      setShowPrintSettings(false);
    }
  };

  const handlePrint = (file) => {
    if (!isStaff) {
      toast.error("Only Staff members can print documents.");
      return;
    }

    setSelectedFile(file);
    setShowPrintSettings(true);
  };

  const handlePrintConfirm = async () => {
    if (!selectedFile) return;

    try {
      if (!isPrintablePdf(selectedFile)) {
        toast.error(
          "Direct in-browser printing is supported for PDF only. Please convert DOC/DOCX to PDF first."
        );
        return;
      }

      const copies = Number(printSettings.copies) || 1;

      const payload = {
        type: PRINT_TRANSACTION_TYPE,
        quantity: copies,
        note: `Printed "${selectedFile.name}" - ${
          copies > 1 ? "copies" : "copy"
        }, ${printSettings.paperSize.toUpperCase()}, ${
          printSettings.orientation
        }, ${printSettings.colorMode}, duplex: ${printSettings.duplex}`,
        user_id: currentUser?.id ?? null,
        username: currentUser?.username ?? null,
      };

      let printLogFailed = false;

      const { data, error } = await supabaseAdmin
        .from("transactions")
        .insert([payload])
        .select();

      if (error) {
        printLogFailed = true;
        console.error("Failed to log print transaction:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payload,
        });

        toast.error(`Print job will continue, but logging failed: ${error.message}`);
      } else {
        console.log("Print transaction logged:", data);
      }

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = selectedFile.url;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          const win = iframe.contentWindow;
          if (!win) throw new Error("Print window not available");

          win.focus();
          win.print();

          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        } catch (err) {
          console.error("Print iframe error:", err);
          toast.error("Unable to open the print dialog.");
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }
      };

      if (printLogFailed) {
        toast.success(`Print job sent: ${selectedFile.name} (not logged)`);
      } else {
        toast.success(`Print job sent: ${selectedFile.name}`);
      }

      setShowPrintSettings(false);
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Something went wrong while printing.");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="Print Service"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
        onNavigateToAccount={onNavigateToAccount}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 transition-colors hover:border-blue-500 hover:bg-blue-50"
          >
            <Upload className="mb-4 h-12 w-12 text-gray-400" />
            <p className="mb-2 text-sm font-medium text-gray-900">
              Click to upload documents
            </p>
            <p className="text-xs text-gray-500">PDF, DOC, DOCX files accepted</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Uploaded Documents ({uploadedFiles.length})
            </h3>

            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isStaff && (
                      <button
                        onClick={() => handlePrint(file)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showPrintSettings && selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Print Settings
                  </h3>
                </div>
                <button
                  onClick={() => setShowPrintSettings(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-lg bg-blue-50 p-3">
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile.name}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Number of Copies
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={printSettings.copies}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        copies: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Paper Size
                  </label>
                  <select
                    value={printSettings.paperSize}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        paperSize: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="letter">Letter (8.5" × 11")</option>
                    <option value="legal">Legal (8.5" × 14")</option>
                    <option value="a4">A4 (210mm × 297mm)</option>
                    <option value="a3">A3 (297mm × 420mm)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Orientation
                  </label>
                  <select
                    value={printSettings.orientation}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        orientation: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Color Mode
                  </label>
                  <select
                    value={printSettings.colorMode}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        colorMode: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="color">Color</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="blackwhite">Black & White</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Duplex Printing
                  </label>
                  <select
                    value={printSettings.duplex}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        duplex: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">None (Single-sided)</option>
                    <option value="long">Long Edge (Flip on long edge)</option>
                    <option value="short">Short Edge (Flip on short edge)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowPrintSettings(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrintConfirm}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}