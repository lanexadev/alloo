import { EmptyState } from "@/components/chat/empty-state";

/** Right pane when no conversation is open. The two-pane shell lives in `layout.tsx`. */
export default function ChatIndexPage() {
	return <EmptyState />;
}
