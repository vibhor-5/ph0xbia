/* ──────────────────────────────────────────────────────────────────────
 *  The Warden — Backend ECDSA Escape Signer
 *  POST /api/sign-escape { sessionId, playerAddr }
 *  Returns { signature } or { error }
 * ────────────────────────────────────────────────────────────────────── */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, playerAddr } = await req.json();

    if (!sessionId || !playerAddr) {
      return NextResponse.json(
        { error: 'Missing sessionId or playerAddr' },
        { status: 400 }
      );
    }

    // Verify all 3 puzzles solved in Supabase
    const { count, error } = await supabase
      .from('task_state')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('player_addr', playerAddr.toLowerCase())
      .eq('action', 'puzzle_solved');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'The Warden cannot verify your claims.' },
        { status: 500 }
      );
    }

    if (!count || count < 3) {
      return NextResponse.json(
        { error: `The Warden denies your release. Puzzles: ${count || 0}/3` },
        { status: 403 }
      );
    }

    // Sign the escape message — must match contract's keccak256(sessionId, msg.sender, "ESCAPED")
    const messageHash = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'string'],
      [BigInt(sessionId), playerAddr, 'ESCAPED']
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    return NextResponse.json({ signature });
  } catch (err) {
    console.error('Warden error:', err);
    return NextResponse.json(
      { error: 'The Warden has encountered darkness.' },
      { status: 500 }
    );
  }
}
