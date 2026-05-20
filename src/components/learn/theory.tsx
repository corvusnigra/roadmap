"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { markTheoryRead } from "@/app/roles/[slug]/nodes/[nodeSlug]/actions";
import { Button } from "@/components/ui/button";

interface TheoryProps {
  roleSlug: string;
  nodeSlug: string;
  initiallyRead: boolean;
  children: ReactNode;
}

export function Theory({
  roleSlug,
  nodeSlug,
  initiallyRead,
  children,
}: TheoryProps) {
  const [read, setRead] = useState(initiallyRead);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-6">
      <div className="prose prose-neutral max-w-none dark:prose-invert">
        {children}
      </div>
      <div className="flex items-center justify-end">
        <Button
          variant={read ? "secondary" : "default"}
          disabled={pending || read}
          onClick={() =>
            startTransition(async () => {
              try {
                await markTheoryRead({ roleSlug, nodeSlug });
                setRead(true);
                toast.success("Theory marked as read");
              } catch (err) {
                toast.error("Failed to mark read", {
                  description: err instanceof Error ? err.message : String(err),
                });
              }
            })
          }
          data-testid="theory-mark-read"
        >
          {read ? (
            <>
              <Check className="mr-1 h-4 w-4" /> Theory read
            </>
          ) : (
            "Mark theory read"
          )}
        </Button>
      </div>
    </section>
  );
}
