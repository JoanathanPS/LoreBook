"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteCourse } from "@/lib/actions/courses";

export function DeleteCourseButton({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="destructive" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 size={14} />
      </Button>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &quot;{courseName}&quot;?</DialogTitle>
          <DialogDescription>
            This permanently deletes every document, chat history, and study tool in this
            course — for you and anyone you&apos;ve shared it with. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={deleteCourse}>
            <input type="hidden" name="courseId" value={courseId} />
            <Button type="submit" variant="destructive">
              Delete course
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
