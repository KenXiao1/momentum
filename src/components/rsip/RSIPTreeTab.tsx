import { RSIPCanvas } from './RSIPCanvas';
import { RSIPDailyReminder } from './RSIPDailyReminder';
import { RSIPForm } from './RSIPForm';
import { RSIPModeSwitch } from './RSIPModeSwitch';
import { RSIPSplitModeSection } from './RSIPSplitModeSection';
import { RSIPStrictModeCard } from './RSIPStrictModeCard';
import { RSIPTaskLinkPanel } from './RSIPTaskLinkPanel';
import type { RSIPViewModel } from './hooks/useRSIPViewModel';
import { fireAndForget } from '../../utils/fireAndForget';

interface RSIPTreeTabProps {
  model: RSIPViewModel;
}

export function RSIPTreeTab({ model }: RSIPTreeTabProps) {
  return (
    <>
      <div className="mb-6">
        <RSIPModeSwitch
          mode={model.currentMode}
          onModeChange={(mode) =>
            fireAndForget(model.handleModeChange(mode), {
              label: 'change-rsip-mode',
            })
          }
        />
      </div>

      {model.isStrictMode && (
        <RSIPDailyReminder
          hasOpenedToday={model.hasOpenedToday}
          treeOpenStreak={model.meta.treeOpenStreak ?? 0}
          onRecordOpened={() =>
            fireAndForget(model.handleRecordTreeOpened(), {
              label: 'record-rsip-tree-opened',
            })
          }
        />
      )}

      <RSIPForm
        tree={model.tree}
        meta={model.meta}
        canAddToday={model.canAddToday}
        selectedParentId={model.selectedParentId}
        setSelectedParentId={model.setSelectedParentId}
        title={model.title}
        setTitle={model.setTitle}
        rule={model.rule}
        setRule={model.setRule}
        createUseTimer={model.createUseTimer}
        setCreateUseTimer={model.setCreateUseTimer}
        createTimerMinutes={model.createTimerMinutes}
        setCreateTimerMinutes={model.setCreateTimerMinutes}
        createType={model.createType}
        setCreateType={model.setCreateType}
        setCreateEmoji={model.setCreateEmoji}
        groups={model.groups}
        selectedGroupId={model.selectedGroupId}
        setSelectedGroupId={model.setSelectedGroupId}
        createIsPassive={model.createIsPassive}
        setCreateIsPassive={model.setCreateIsPassive}
        onCreateGroup={() =>
          fireAndForget(model.handleCreateGroup(), {
            label: 'create-rsip-group',
          })
        }
        onAdd={() =>
          fireAndForget(model.handleAddSingle(), {
            label: 'add-rsip-node',
          })
        }
        language={model.language}
        t={model.t}
      />

      <RSIPSplitModeSection
        splitMode={model.splitMode}
        setSplitMode={model.setSplitMode}
        splitGoal={model.splitGoal}
        setSplitGoal={model.setSplitGoal}
        splitItems={model.splitItems}
        setSplitItems={model.setSplitItems}
        splitTemplateKeys={model.splitTemplateKeys}
        onApplySplitTemplate={model.handleApplySplitTemplate}
        onAddSplitRow={model.handleAddSplitRow}
        onSubmitSplit={() =>
          fireAndForget(model.handleSubmitSplit(), {
            label: 'submit-rsip-split',
          })
        }
        canAddToday={model.canAddToday}
        t={model.t}
      />

      <RSIPCanvas
        nodes={model.nodes}
        tree={model.tree}
        onSaveNodes={model.onSaveNodes}
        onMarkFailedNode={(nodeId: string) => {
          const target = model.nodes.find((item) => item.id === nodeId);
          if (target) {
            model.openViolationDialog(target);
          }
        }}
        language={model.language}
        t={model.t}
      />

      {model.isStrictMode && model.nodes.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
            {model.t('rsip.rsipTreeTab.policyExecutionTracking')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {model.nodes.map((node) => {
              const { descendantCount, failureCost } =
                model.calculateConstraintPower(node.id);
              return (
                <RSIPStrictModeCard
                  key={node.id}
                  node={node}
                  descendantCount={descendantCount}
                  failureCost={failureCost}
                  onMarkExecuted={() =>
                    fireAndForget(model.handleMarkExecuted(node.id), {
                      label: 'mark-rsip-node-executed',
                    })
                  }
                  onMarkViolated={() => model.openViolationDialog(node)}
                  onReinforce={
                    model.onReinforceNode
                      ? () => {
                          const reinforceNode = model.onReinforceNode;
                          if (!reinforceNode) {
                            return;
                          }
                          fireAndForget(
                            reinforceNode(node.id, model.nodes, 1),
                            { label: 'reinforce-rsip-node' },
                          );
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8">
        <RSIPTaskLinkPanel
          links={model.taskLinks}
          nodes={model.nodes}
          chains={model.chains}
          onUpsertLinks={(nextLinks) => model.handleTaskLinkUpsert(nextLinks)}
        />
      </div>
    </>
  );
}
