import { ApiError, type OperationContext } from "@/lib/api/http";
import {
  deletePendingSearchRun,
  findSearchRunRecordById
} from "@/lib/db/searches";

export async function cancelPendingSearchRun(
  searchRunId: string,
  context: OperationContext
): Promise<{ id: string }> {
  const deleted = await deletePendingSearchRun(searchRunId, context);
  if (deleted) {
    return { id: searchRunId };
  }

  const record = await findSearchRunRecordById(searchRunId, context);
  if (!record) {
    throw new ApiError("not_found", "Search run not found", 404);
  }

  throw new ApiError(
    "conflict_error",
    "Only pending search runs can be cancelled",
    409
  );
}
