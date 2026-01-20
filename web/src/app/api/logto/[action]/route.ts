import LogtoClient from '@logto/next';
import { logtoConfig } from '@/lib/logto';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    const client = new LogtoClient(logtoConfig) as any;
    const { action } = await params;

    if (action === 'sign-in') {
        return client.handleSignIn();
    }
    if (action === 'sign-out') {
        return client.handleSignOut();
    }
    if (action === 'sign-in-callback') {
        return client.handleSignInCallback(request.url);
    }

    return new NextResponse('Not Found', { status: 404 });
}

export const POST = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    const client = new LogtoClient(logtoConfig) as any;
    const { action } = await params;

    if (action === 'sign-in') {
        return client.handleSignIn();
    }
    if (action === 'sign-out') {
        return client.handleSignOut();
    }

    return new NextResponse('Not Found', { status: 404 });
}
