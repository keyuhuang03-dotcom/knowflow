import { NextResponse } from "next/server";
import { withAccess } from "@/lib/request-guard";
import { recentIntakes } from "@/lib/recent-intakes";
export const GET = withAccess(async () => NextResponse.json(await recentIntakes()));
