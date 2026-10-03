"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { deleteCategory, upsertCategory } from "@/lib/db";
import { COLOR_CHOICES, CategoryIcon, ICONS, ICON_NAMES } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Category, TxType } from "@/types";

export default function CategoriesPage() {
  const { categories, reloadReference, notifyChange } = useAppData();
  const [tab, setTab] = useState<TxType>("expense");
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const list = categories.filter((c) => c.type === tab);

  async function refresh() {
    await reloadReference();
    notifyChange();
  }

  async function toggleArchive(c: Category) {
    try {
      await upsertCategory({ id: c.id, name: c.name, type: c.type, archived: !c.archived });
      await refresh();
      toast.success(c.archived ? "Category restored" : "Category archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Colors and icons you pick here are used everywhere — charts, lists and the calendar."
        actions={
          <Button onClick={() => setEditing({ type: tab, color: COLOR_CHOICES[9], icon: "tag", name: "" })}>
            <Plus /> New category
          </Button>
        }
      />
      <div className="mb-4 inline-flex rounded-xl bg-muted p-1">
        {(["expense", "income"] as TxType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all",
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Tags className="size-6" />} title={`No ${tab} categories`}>
          Create one to start organizing your {tab === "expense" ? "spending" : "income"}.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className={cn("flex-row items-center gap-3 p-3", c.archived && "opacity-60")}>
              <CategoryIcon name={c.icon} color={c.color} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                {c.archived && <Badge variant="secondary">Archived</Badge>}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(c)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={c.archived ? "Restore" : "Archive"} onClick={() => toggleArchive(c)}>
                {c.archived ? <ArchiveRestore /> : <Archive />}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(c)}>
                <Trash2 className="text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog editing={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="Transactions in this category are kept but become Uncategorized. Its budget is removed. Consider archiving instead."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteCategory(deleting.id);
            await refresh();
            toast.success("Category deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </>
  );
}

function CategoryDialog({
  editing, onClose, onSaved,
}: { editing: Partial<Category> | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<Partial<Category>>({});
  const [lastEditing, setLastEditing] = useState<Partial<Category> | null>(null);
  if (editing !== lastEditing) {
    setLastEditing(editing);
    if (editing) setDraft(editing);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = (draft.name ?? "").trim();
    if (!name) return toast.error("Give the category a name");
    try {
      await upsertCategory({
        id: draft.id, name, type: draft.type ?? "expense",
        color: draft.color ?? COLOR_CHOICES[9], icon: draft.icon ?? "tag",
      });
      await onSaved();
      toast.success(draft.id ? "Category updated" : "Category created");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg.includes("duplicate") ? "A category with that name already exists" : msg);
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="flex items-center gap-3">
            <CategoryIcon name={draft.icon} color={draft.color} size={48} />
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" autoFocus value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
          </div>
          {!draft.id && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["expense", "income"] as TxType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft({ ...draft, type: t })}
                  className={cn(
                    "rounded-lg py-1.5 text-sm font-medium capitalize",
                    draft.type === t ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-popover transition-transform hover:scale-110",
                    draft.color === c && "ring-2 ring-foreground"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_NAMES.map((n) => {
                const Icon = ICONS[n];
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={n}
                    onClick={() => setDraft({ ...draft, icon: n })}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted",
                      draft.icon === n && "border-primary bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
