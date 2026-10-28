"use client";

import { unzipSync, strFromU8 } from "fflate";
import { ChevronDownIcon, HardDriveDownloadIcon, ImagesIcon, Loader2Icon, MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ContactPicker, type ContactOption } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadFile, type UploadConfig } from "@/lib/upload-client";
import { parseWhatsApp, type WhatsAppDay } from "@/lib/whatsapp";
import { createEntry } from "@/server/actions/entries";
import { importWhatsAppDays } from "@/server/actions/imports";
import { DriveImportDialog } from "./drive-import";

type Parsed = { chatName: string; days: WhatsAppDay[]; participants: string[]; count: number };

/** Bulk imports that land in the Inbox: screenshots (read by the AI), WhatsApp exports, Google Drive. */
export function InboxImports({
  uploadConfig,
  contacts,
  driveConnected,
}: {
  uploadConfig: UploadConfig;
  contacts: ContactOption[];
  driveConnected: boolean;
}) {
  const router = useRouter();
  const screenshots = useRef<HTMLInputElement>(null);
  const chat = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [owner, setOwner] = useState<string>("");
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [driveOpen, setDriveOpen] = useState(false);

  const importScreenshots = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let done = 0;
    for (const file of Array.from(files)) {
      try {
        const created = await createEntry({ type: "message", title: "Capture d'écran" });
        if (!created.ok) throw new Error(created.error);
        await uploadFile(file, uploadConfig, { entryId: created.data.id });
        done += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import impossible.", { description: file.name });
      }
    }
    setBusy(false);
    if (done) {
      toast.success(`${done} capture${done > 1 ? "s" : ""} importée${done > 1 ? "s" : ""}`, {
        description: "L'IA lit chaque image et en retranscrit la conversation.",
      });
      router.refresh();
    }
  };

  const readChat = async (file: File | undefined) => {
    if (!file) return;
    try {
      let text: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
          filter: (entry) => entry.name.toLowerCase().endsWith(".txt"),
        });
        const name = Object.keys(files).find((n) => /_chat\.txt$/i.test(n)) ?? Object.keys(files)[0];
        if (!name) throw new Error("Aucune conversation trouvée dans l'archive.");
        text = strFromU8(files[name]);
      } else {
        text = await file.text();
      }
      const result = parseWhatsApp(text);
      if (result.count === 0) throw new Error("Format non reconnu. Exporte la discussion depuis WhatsApp (sans médias).");
      const chatName = file.name.replace(/\.(txt|zip)$/i, "").replace(/^(WhatsApp Chat( with)?|Discussion WhatsApp avec)\s*-?\s*/i, "").trim() || "Conversation";
      setParsed({ chatName, ...result });
      setOwner(result.participants.length === 2 ? result.participants[1] : "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture impossible.");
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setBusy(true);
    let created = 0;
    try {
      // Server Actions have a body limit: send the history in chunks.
      for (let i = 0; i < parsed.days.length; i += 60) {
        const result = await importWhatsAppDays({
          chatName: parsed.chatName,
          ownerName: owner || null,
          contactId: contactIds[0] ?? null,
          days: parsed.days.slice(i, i + 60),
        });
        if (!result.ok) throw new Error(result.error);
        created += result.data.created;
      }
      toast.success(`${created} journée${created > 1 ? "s" : ""} de conversation importée${created > 1 ? "s" : ""}`);
      setParsed(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            Importer
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => screenshots.current?.click()}>
            <ImagesIcon />
            Captures d&apos;écran (DM, WhatsApp…)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chat.current?.click()}>
            <MessageCircleIcon />
            Discussion WhatsApp exportée
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => (driveConnected ? setDriveOpen(true) : router.push("/reglages#integrations"))}>
            <HardDriveDownloadIcon />
            {driveConnected ? "Depuis Google Drive" : "Google Drive (à connecter)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={screenshots}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void importScreenshots(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={chat}
        type="file"
        accept=".txt,.zip,text/plain,application/zip"
        hidden
        onChange={(event) => {
          void readChat(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Dialog open={parsed !== null} onOpenChange={(open) => !open && setParsed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer la discussion</DialogTitle>
            <DialogDescription>
              {parsed
                ? `${parsed.count} messages sur ${parsed.days.length} jour${parsed.days.length > 1 ? "s" : ""}. Une entrée par journée, dans l'Inbox.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {parsed ? (
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-[13px]">
                <span className="text-muted-foreground">Nom de la conversation</span>
                <Input value={parsed.chatName} onChange={(event) => setParsed({ ...parsed, chatName: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-[13px]">
                <span className="text-muted-foreground">Toi dans cette conversation</span>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.participants.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="grid gap-1.5 text-[13px]">
                <span className="text-muted-foreground">Relier au contact</span>
                <ContactPicker contacts={contacts} value={contactIds} onChange={(ids) => setContactIds(ids.slice(-1))} placeholder="Aucun" />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParsed(null)}>
              Annuler
            </Button>
            <Button onClick={() => void runImport()} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : null}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {driveConnected ? <DriveImportDialog open={driveOpen} onOpenChange={setDriveOpen} /> : null}
    </>
  );
}
