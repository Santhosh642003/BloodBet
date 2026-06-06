/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { DbConnection, tables } from '../../spacetime';
import type { EventContext, ErrorContext } from '../../spacetime';

const SPACETIME_URI = import.meta.env.VITE_SPACETIMEDB_HOST || 'wss://maincloud.spacetimedb.com';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME || 'bloodbet-dre-dev';
const normalize = (row: any): any => {
  if (!row || typeof row !== 'object') return row;
  const out: any = {};
  for (const key of Object.keys({ ...row })) {
    const v = (row as any)[key];
    out[key] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
};

const normalizeAll = (iter: Iterable<any>): any[] => [...iter].map(normalize);

export function useSpacetime() {
  const [conn, setConn]                             = useState<DbConnection | null>(null);
  const [identity, setIdentity]                     = useState<string | null>(null);
  const [connected, setConnected]                   = useState(false);
  const [currentUser, setCurrentUser]               = useState<any | null>(null);
  const [fighters, setFighters]                     = useState<any[]>([]);
  const [tournaments, setTournaments]               = useState<any[]>([]);
  const [tournamentFighters, setTournamentFighters] = useState<any[]>([]);
  const [arenaTiles, setArenaTiles]                 = useState<any[]>([]);
  const [bets, setBets]                             = useState<any[]>([]);
  const [liveEvents, setLiveEvents]                 = useState<any[]>([]);
  const [sponsorDrops, setSponsorDrops]             = useState<any[]>([]);
  const [contracts, setContracts]                   = useState<any[]>([]);
  const [auctionBids, setAuctionBids]               = useState<any[]>([]);
  const [users, setUsers]                           = useState<any[]>([]);
  const [friendships, setFriendships]               = useState<any[]>([]);
  const [notifications, setNotifications]           = useState<any[]>([]);
  const [eventBetSlips, setEventBetSlips]           = useState<any[]>([]);
  const [eventBetPositions, setEventBetPositions]   = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('spacetime_token') ?? undefined;

    const connection = DbConnection.builder()
      .withUri(SPACETIME_URI)
      .withDatabaseName(DB_NAME)
      .withToken(token)
      .onConnect((ctx, id, newToken) => {
        localStorage.setItem('spacetime_token', newToken);
        setIdentity(id.toHexString());
        setConnected(true);

        ctx.subscriptionBuilder()
          .onApplied(() => {
            setFighters(normalizeAll(ctx.db.fighterTemplate.iter()));
            setTournaments(normalizeAll(ctx.db.tournament.iter()));
            setTournamentFighters(normalizeAll(ctx.db.tournamentFighter.iter()));
            setArenaTiles(normalizeAll(ctx.db.arenaTile.iter()));
            setBets(normalizeAll(ctx.db.bet.iter()));
            setLiveEvents(normalizeAll(ctx.db.liveEvent.iter()));
            setSponsorDrops(normalizeAll(ctx.db.sponsorDrop.iter()));
            setContracts(normalizeAll(ctx.db.contract.iter()));
            setAuctionBids(normalizeAll(ctx.db.auctionBid.iter()));
            setUsers(normalizeAll(ctx.db.user.iter()));
            setFriendships(normalizeAll(ctx.db.friendship.iter()));
            setNotifications(normalizeAll(ctx.db.notification.iter()).filter(n => n.recipientId?.toHexString?.() === id.toHexString()));
            setEventBetSlips(normalizeAll(ctx.db.eventBetSlip.iter()));
            setEventBetPositions(normalizeAll(ctx.db.eventBetPosition.iter()));

            const me = ctx.db.user.identity.find(id);
            if (me) setCurrentUser(normalize(me));
          })
          .subscribe([
            tables.user,
            tables.fighterTemplate,
            tables.tournament,
            tables.tournamentFighter,
            tables.arenaTile,
            tables.bet,
            tables.liveEvent,
            tables.sponsorDrop,
            tables.contract,
            tables.auctionBid,
            tables.friendship,
            tables.notification,
            tables.eventBetSlip,
            tables.eventBetPosition,
          ]);

        ctx.db.fighterTemplate.onInsert(()   => setFighters(normalizeAll(ctx.db.fighterTemplate.iter())));
        ctx.db.fighterTemplate.onUpdate(()   => setFighters(normalizeAll(ctx.db.fighterTemplate.iter())));
        ctx.db.tournament.onInsert(()        => setTournaments(normalizeAll(ctx.db.tournament.iter())));
        ctx.db.tournament.onUpdate(()        => setTournaments(normalizeAll(ctx.db.tournament.iter())));
        ctx.db.tournamentFighter.onInsert(() => setTournamentFighters(normalizeAll(ctx.db.tournamentFighter.iter())));
        ctx.db.tournamentFighter.onUpdate(() => setTournamentFighters(normalizeAll(ctx.db.tournamentFighter.iter())));
        ctx.db.arenaTile.onInsert(()         => setArenaTiles(normalizeAll(ctx.db.arenaTile.iter())));
        ctx.db.arenaTile.onUpdate(()         => setArenaTiles(normalizeAll(ctx.db.arenaTile.iter())));
        ctx.db.bet.onInsert(()               => setBets(normalizeAll(ctx.db.bet.iter())));
        ctx.db.bet.onUpdate(()               => setBets(normalizeAll(ctx.db.bet.iter())));
        ctx.db.eventBetSlip.onInsert(()      => setEventBetSlips(normalizeAll(ctx.db.eventBetSlip.iter())));
        ctx.db.eventBetSlip.onUpdate(()      => setEventBetSlips(normalizeAll(ctx.db.eventBetSlip.iter())));
        ctx.db.eventBetPosition.onInsert(()  => setEventBetPositions(normalizeAll(ctx.db.eventBetPosition.iter())));
        ctx.db.eventBetPosition.onUpdate(()  => setEventBetPositions(normalizeAll(ctx.db.eventBetPosition.iter())));
        ctx.db.liveEvent.onInsert(()         => setLiveEvents(normalizeAll(ctx.db.liveEvent.iter())));
        ctx.db.sponsorDrop.onInsert(()       => setSponsorDrops(normalizeAll(ctx.db.sponsorDrop.iter())));
        ctx.db.sponsorDrop.onUpdate(()       => setSponsorDrops(normalizeAll(ctx.db.sponsorDrop.iter())));
        ctx.db.contract.onInsert(()          => setContracts(normalizeAll(ctx.db.contract.iter())));
        ctx.db.contract.onUpdate(()          => setContracts(normalizeAll(ctx.db.contract.iter())));
        ctx.db.auctionBid.onInsert(()        => setAuctionBids(normalizeAll(ctx.db.auctionBid.iter())));
        ctx.db.friendship.onInsert(()        => setFriendships(normalizeAll(ctx.db.friendship.iter())));
        ctx.db.friendship.onUpdate(()        => setFriendships(normalizeAll(ctx.db.friendship.iter())));
        ctx.db.friendship.onDelete(()        => setFriendships(normalizeAll(ctx.db.friendship.iter())));
        const refreshNotifications = () => setNotifications(
          normalizeAll(ctx.db.notification.iter()).filter((n: any) => n.recipientId?.toHexString?.() === id.toHexString())
        );
        ctx.db.notification.onInsert(refreshNotifications);
        ctx.db.notification.onUpdate(refreshNotifications);
        ctx.db.notification.onDelete(refreshNotifications);
        ctx.db.user.onInsert((_ctx: EventContext, row: any) => {
          setUsers(normalizeAll(ctx.db.user.iter()));
          if (row.identity.toHexString() === id.toHexString()) setCurrentUser(normalize(row));
        });
        ctx.db.user.onUpdate((_ctx: EventContext, _old: any, row: any) => {
          setUsers(normalizeAll(ctx.db.user.iter()));
          if (row.identity.toHexString() === id.toHexString()) setCurrentUser(normalize(row));
        });
      })
      .onDisconnect(() => setConnected(false))
      .onConnectError((_ctx: ErrorContext, err: Error) => console.error('SpacetimeDB error:', err))
      .build();

    setConn(connection);
    return () => {};
  }, []);

  const register = useCallback((username: string, email: string, passwordHash: string) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.registerUser({ username, email, passwordHash });
  }, [conn]);

  const updateAccount = useCallback((username: string) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.updateAccount({ username });
  }, [conn]);

  const verifyLogin = useCallback((usernameOrEmail: string, passwordHash: string) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.verifyLogin({ usernameOrEmail, passwordHash });
  }, [conn]);

  const placeBet = useCallback((fighterId: number, betType: string, amount: number) => {
    conn?.reducers.placeBet({ fighterId, betType, amount });
  }, [conn]);

  const createEventBetSlip = useCallback((tournamentId: number, fighter1Id: number, action: string, fighter2Id: number, roundsDuration: number, side: string, amount: number) => {
    conn?.reducers.createEventBetSlip({ tournamentId, fighter1Id, action, fighter2Id, roundsDuration, side, amount });
  }, [conn]);

  const joinEventBetSlip = useCallback((slipId: number, side: string, amount: number) => {
    conn?.reducers.joinEventBetSlip({ slipId, side, amount });
  }, [conn]);

  const sponsorFighter = useCallback((fighterId: number, itemType: string) => {
    conn?.reducers.sponsorFighter({ fighterId, itemType });
  }, [conn]);

  const createTournament = useCallback((name: string, arenaType: string) => {
    conn?.reducers.createTournament({ name, arenaType });
  }, [conn]);

  const createFighter = useCallback((
    name: string, lore: string, archetype: string,
    strength: number, speed: number, intelligence: number,
    luck: number, charisma: number
  ) => {
    conn?.reducers.createFighter({ name, lore, archetype, strength, speed, intelligence, luck, charisma });
  }, [conn]);

  const hostTournament = useCallback((name: string, arenaType: string) => {
    conn?.reducers.hostTournament({ name, arenaType });
  }, [conn]);

  const placeBid = useCallback((fighterId: number, amount: number) => {
    conn?.reducers.placeBid({ fighterId, amount });
  }, [conn]);

  const updateProfile = useCallback((bio: string, avatarEmoji: string, favoriteArchetype: string) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.updateProfile({ bio, avatarEmoji, favoriteArchetype });
  }, [conn]);

  const sendFriendRequest = useCallback((addresseeId: any) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.sendFriendRequest({ addresseeId });
  }, [conn]);

  const respondToFriendRequest = useCallback((friendshipId: number, accept: boolean) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.respondToFriendRequest({ friendshipId, accept });
  }, [conn]);

  const removeFriend = useCallback((friendshipId: number) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.removeFriend({ friendshipId });
  }, [conn]);

  const markNotificationRead = useCallback((notificationId: number) => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.markNotificationRead({ notificationId });
  }, [conn]);

  const markAllNotificationsRead = useCallback(() => {
    if (!conn) return Promise.reject(new Error('Not connected to the arena yet'));
    return conn.reducers.markAllNotificationsRead({});
  }, [conn]);

  const logout = useCallback(() => {
    localStorage.removeItem('spacetime_token');
    setCurrentUser(null);
    window.location.href = '/login';
  }, []);

  return {
    conn, identity, connected, currentUser,
    fighters, tournaments, tournamentFighters, arenaTiles,
    bets, liveEvents, sponsorDrops, contracts, auctionBids, users, friendships, notifications,
    eventBetSlips, eventBetPositions,
    register, verifyLogin, updateAccount, placeBet, sponsorFighter,
    createTournament, createFighter, hostTournament, placeBid, logout,
    updateProfile, sendFriendRequest, respondToFriendRequest, removeFriend,
    markNotificationRead, markAllNotificationsRead,
    createEventBetSlip, joinEventBetSlip,
  };
}