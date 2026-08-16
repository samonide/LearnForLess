"use client";

import { deleteToken, disableToken, enableToken } from "@/actions/admin/tokens";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ban, CheckCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

interface TokenRowActionsProps {
  tokenId: string;
  isActive: boolean;
}

export default function TokenRowActions({
  tokenId,
  isActive,
}: TokenRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggleStatus() {
    startTransition(async () => {
      const res = isActive ? await disableToken(tokenId) : await enableToken(tokenId);
      if (res.success) {
        toast.success(isActive ? "Token deactivated." : "Token activated.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this token? Students who used this token to register will KEEP their access, but no new student will be able to redeem it."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await deleteToken(tokenId);
      if (res.success) {
        toast.success("Access token deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={isPending} />}
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => router.push(`/admin/tokens/${tokenId}/edit`)}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          <Pencil className="w-4 h-4" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleToggleStatus}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          {isActive ? (
            <>
              <Ban className="w-4 h-4 text-amber-600" />
              <span>Deactivate</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Activate</span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive font-medium"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Token</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
