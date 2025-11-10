import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Download, Trash2, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { CardData } from "@/utils/ocrProcessor";

interface CardDataTableProps {
  cards: CardData[];
  onUpdateCard: (id: string, updates: Partial<CardData>) => void;
  onDeleteCard: (id: string) => void;
}

export const CardDataTable = ({ cards, onUpdateCard, onDeleteCard }: CardDataTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<CardData | null>(null);
  const { toast } = useToast();

  const startEdit = (card: CardData) => {
    setEditingId(card.id);
    setEditData({ ...card });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = () => {
    if (editingId && editData) {
      onUpdateCard(editingId, editData);
      setEditingId(null);
      setEditData(null);
      toast({
        title: "Updated successfully",
        description: "Card data has been updated",
      });
    }
  };

  const handleExportCSV = () => {
    if (cards.length === 0) {
      toast({
        title: "No data to export",
        description: "Please add some cards first",
        variant: "destructive",
      });
      return;
    }

    const csv = Papa.unparse(cards);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-cards-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "CSV file has been downloaded",
    });
  };

  if (cards.length === 0) {
    return (
      <Card className="p-12 text-center shadow-medium bg-gradient-card">
        <p className="text-muted-foreground text-lg">No cards scanned yet. Upload or capture a business card to get started.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-medium bg-gradient-card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-foreground">Extracted Card Data</h2>
        <Button
          onClick={handleExportCSV}
          className="bg-accent hover:bg-accent-hover text-accent-foreground transition-smooth shadow-soft"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left p-3 font-semibold text-foreground">Name</th>
              <th className="text-left p-3 font-semibold text-foreground">Company</th>
              <th className="text-left p-3 font-semibold text-foreground">Designation</th>
              <th className="text-left p-3 font-semibold text-foreground">Email</th>
              <th className="text-left p-3 font-semibold text-foreground">Phone</th>
              <th className="text-left p-3 font-semibold text-foreground">Website</th>
              <th className="text-left p-3 font-semibold text-foreground">Address</th>
              <th className="text-left p-3 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id} className="border-b border-border hover:bg-muted/50 transition-smooth">
                {editingId === card.id && editData ? (
                  <>
                    <td className="p-2">
                      <Input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.company}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.designation}
                        onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="min-w-[150px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.phone}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.website}
                        onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                        className="min-w-[150px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.address}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        className="min-w-[200px]"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveEdit} className="h-8 w-8 text-primary hover:bg-primary/10">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8 text-muted-foreground hover:bg-muted">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 text-foreground">{card.name}</td>
                    <td className="p-3 text-foreground">{card.company}</td>
                    <td className="p-3 text-foreground">{card.designation}</td>
                    <td className="p-3 text-foreground">{card.email}</td>
                    <td className="p-3 text-foreground">{card.phone}</td>
                    <td className="p-3 text-foreground">{card.website}</td>
                    <td className="p-3 text-foreground max-w-[200px] truncate" title={card.address}>
                      {card.address}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(card)}
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDeleteCard(card.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
