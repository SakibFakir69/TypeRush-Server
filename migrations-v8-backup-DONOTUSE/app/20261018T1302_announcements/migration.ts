#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract';
import startContract from '../../snapshots/13050c9e3a341dd940ebe0b31cb99b2b21571944f6aa1a209fb43bd00885190a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/954df7fbf3120a09fd9303032700418c7b8e0761e487b8b87d8484a24382a4c5/contract';
import endContract from '../../snapshots/954df7fbf3120a09fd9303032700418c7b8e0761e487b8b87d8484a24382a4c5/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'announcement',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'contest',
        columns: [
          col('condition', 'text', {
            notNull: true,
            default: lit('UPCOMING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('time', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'contest_condition_check_2acdb471',
            "\"condition\" IN ('RUNNING', 'FINISHED', 'UPCOMING')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'contestParticipant',
        columns: [
          col('contestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'contestId'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('role', 'text', {
          notNull: true,
          default: lit('USER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_check_7d146180',
        expression: "\"role\" IN ('ADMIN', 'USER', 'ORG')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'announcement',
        index: 'announcement_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contest',
        index: 'contest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_contestId_idx_8a30d986',
        columns: ['contestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_userId_contestId_idx_0208880e',
        columns: ['userId', 'contestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contestParticipant',
        index: 'contestParticipant_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'announcement',
        foreignKey: {
          name: 'announcement_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contest',
        foreignKey: {
          name: 'contest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contestParticipant',
        foreignKey: {
          name: 'contestParticipant_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contestParticipant',
        foreignKey: {
          name: 'contestParticipant_contestId_fkey',
          columns: ['contestId'],
          references: { schema: 'public', table: 'contest', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
