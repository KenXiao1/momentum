import { ExceptionRuleType } from '../../types';
import type {
  MigrationResult,
  MigrationProgress,
  RollbackResult,
} from './migrationTypes';
import {
  MIGRATION_VERSION,
  LEGACY_MIGRATED_DESCRIPTION_ZH,
  LEGACY_MIGRATED_DESCRIPTION_EN,
} from './migrationTypes';
import { MigrationStorage } from './MigrationStorage';
import { MigrationAnalyzer } from './MigrationAnalyzer';
import { exceptionRuleManager } from '../ExceptionRuleManager';
import { logger } from '../../utils/logger';
import { getCurrentLanguage, t } from '../../utils/runtimeI18n';
import { getSafeErrorDetail, toError } from '../../utils/errorMessage';

export class MigrationExecutor {
  private analyzer: MigrationAnalyzer;

  constructor(private migrationStorage: MigrationStorage) {
    this.analyzer = new MigrationAnalyzer(migrationStorage);
  }
  async needsMigration(): Promise<boolean> {
    try {
      const migrationInfo = this.migrationStorage.getMigrationInfo();
      if (migrationInfo && migrationInfo.version === MIGRATION_VERSION) {
        return false;
      }

      const chains = await this.migrationStorage.getLegacyChains();
      const chainsWithExceptions = chains.filter(
        (chain) => chain.exceptions && chain.exceptions.length > 0,
      );

      return chainsWithExceptions.length > 0;
    } catch (error) {
      const err = toError(error);
      logger.error('MIGRATION_EXECUTOR', '检查迁移需求失败', undefined, err);
      return false;
    }
  }
  async migrate(
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<MigrationResult> {
    const startTime = new Date();
    const result: MigrationResult = {
      totalChains: 0,
      migratedRules: 0,
      skippedRules: 0,
      errors: [],
      createdRules: [],
      migrationTime: startTime,
    };

    try {
      onProgress?.({
        currentChain: 0,
        totalChains: 0,
        currentChainName: '',
        phase: 'analyzing',
        message: t('migration.migrationExecutor.analyzingExistingData'),
      });

      const chains = await this.migrationStorage.getLegacyChains();
      const chainsWithExceptions = chains.filter(
        (chain) => chain.exceptions && chain.exceptions.length > 0,
      );

      result.totalChains = chainsWithExceptions.length;

      if (result.totalChains === 0) {
        onProgress?.({
          currentChain: 0,
          totalChains: 0,
          currentChainName: '',
          phase: 'complete',
          message: t('migration.migrationExecutor.noDataToMigrate'),
        });
        return result;
      }

      onProgress?.({
        currentChain: 0,
        totalChains: result.totalChains,
        currentChainName: '',
        phase: 'migrating',
        message: t(
          'migration.migrationExecutor.startingMigrationForExceptionRulesFromResultTotalChainsChainS',
          { resultTotalChains: result.totalChains },
        ),
      });

      const uniqueRules = this.collectUniqueRules(chainsWithExceptions);
      const createdRuleIds = await this.createRules(
        uniqueRules,
        result,
        onProgress,
      );

      onProgress?.({
        currentChain: result.totalChains,
        totalChains: result.totalChains,
        currentChainName: '',
        phase: 'cleanup',
        message: t(
          'migration.migrationExecutor.migrationDoneSavingMigrationInfo',
        ),
      });

      this.migrationStorage.saveMigrationInfo({
        version: MIGRATION_VERSION,
        migratedAt: startTime,
        totalRules: result.migratedRules,
        skippedRules: result.skippedRules,
        errors: result.errors.length,
        createdRuleIds,
      });

      onProgress?.({
        currentChain: result.totalChains,
        totalChains: result.totalChains,
        currentChainName: '',
        phase: 'complete',
        message: t(
          'migration.migrationExecutor.migrationCompletedCreatedResultMigratedRulesRuleS',
          { resultMigratedRules: result.migratedRules },
        ),
      });

      return result;
    } catch (error) {
      const err = toError(error);
      logger.error('MIGRATION_EXECUTOR', '迁移过程中发生错误', undefined, err);
      result.errors.push({
        chainId: 'system',
        chainName: 'Migration System',
        error: this.formatError(error),
      });
      return result;
    }
  }
  private collectUniqueRules(
    chainsWithExceptions: Array<{ exceptions: string[] }>,
  ): Set<string> {
    const uniqueRules = new Set<string>();
    for (const chain of chainsWithExceptions) {
      chain.exceptions.forEach((exception) => {
        if (exception.trim()) {
          uniqueRules.add(exception.trim());
        }
      });
    }
    return uniqueRules;
  }
  private async createRules(
    uniqueRules: Set<string>,
    result: MigrationResult,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<string[]> {
    const createdRuleIds: string[] = [];
    let currentIndex = 0;

    for (const ruleName of uniqueRules) {
      currentIndex++;

      onProgress?.({
        currentChain: currentIndex,
        totalChains: uniqueRules.size,
        currentChainName: ruleName,
        phase: 'migrating',
        message: t('migration.migrationExecutor.creatingRuleRuleName', {
          ruleName: ruleName,
        }),
      });

      try {
        const createResult = await exceptionRuleManager.createRule(
          ruleName,
          ExceptionRuleType.PAUSE_ONLY,
          // These stored markers identify legacy rules during later rollback.
          getCurrentLanguage() === 'zh'
            ? LEGACY_MIGRATED_DESCRIPTION_ZH
            : LEGACY_MIGRATED_DESCRIPTION_EN,
        );

        result.createdRules.push(createResult.rule);
        createdRuleIds.push(createResult.rule.id);
        result.migratedRules++;
      } catch (error) {
        const err = toError(error);
        logger.warn(
          'MIGRATION_EXECUTOR',
          `创建规则 "${ruleName}" 失败`,
          undefined,
          err,
        );
        result.skippedRules++;
        result.errors.push({
          chainId: 'migration',
          chainName: ruleName,
          error: this.formatError(error),
        });
      }
    }

    return createdRuleIds;
  }
  async rollback(): Promise<RollbackResult> {
    try {
      const migrationInfo = this.migrationStorage.getMigrationInfo();
      if (!migrationInfo) {
        return {
          success: false,
          message: t('migration.migrationExecutor.noMigrationRecordFound'),
          deletedRules: 0,
        };
      }

      const allRules = await exceptionRuleManager.getAllRules();
      const migratedRules = this.analyzer.filterMigratedRules(
        allRules,
        migrationInfo,
      );

      let deletedCount = 0;
      for (const rule of migratedRules) {
        try {
          await exceptionRuleManager.deleteRule(rule.id);
          deletedCount++;
        } catch (error) {
          const err = toError(error);
          logger.warn(
            'MIGRATION_EXECUTOR',
            `删除规则 ${rule.name} 失败`,
            { ruleId: rule.id },
            err,
          );
        }
      }

      this.migrationStorage.clearMigrationInfo();

      return {
        success: true,
        message: t(
          'migration.migrationExecutor.rollbackSucceededDeletedDeletedCountRuleS',
          { deletedCount: deletedCount },
        ),
        deletedRules: deletedCount,
      };
    } catch (error) {
      const err = toError(error);
      logger.error('MIGRATION_EXECUTOR', 'Rollback failed', undefined, err);
      return {
        success: false,
        message: t('migration.migrationExecutor.rollbackFailed'),
        deletedRules: 0,
      };
    }
  }
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const safe = getSafeErrorDetail(error.message, getCurrentLanguage());
      return (
        safe ??
        t('migration.migrationExecutor.operationFailedCheckConsoleForDetails')
      );
    }
    return t('focusMode.useExceptionRuleOperations.unknownError');
  }
}
