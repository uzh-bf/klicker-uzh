import {
  faArrowDown,
  faArrowUp,
  faChevronDown,
  faChevronRight,
  faCopy,
  faPlus,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  NumberField,
  Select,
  TextareaField,
  TextField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import ConfirmationModal from './ConfirmationModal'
import IconAction from './IconAction'
import {
  canAddChild,
  canReparentNode,
  CompetenceTreeStructuralCommand,
  getBreadcrumb,
  getChildren,
  getDescendantKeys,
  getNodeDepth,
  getNormalizedRootWeights,
} from './treeHelpers'
import { CompetenceTreeForm, CompetenceTreeNodeForm } from './types'

function OutlineNode({
  node,
  form,
  depth,
  selectedKey,
  collapsedKeys,
  onSelect,
  onToggle,
}: {
  node: CompetenceTreeNodeForm
  form: CompetenceTreeForm
  depth: number
  selectedKey: string | null
  collapsedKeys: Set<string>
  onSelect: (key: string) => void
  onToggle: (key: string) => void
}) {
  const t = useTranslations()
  const children = getChildren(form.nodes, node.key)
  const collapsed = collapsedKeys.has(node.key)

  return (
    <li>
      <div
        className={`flex min-h-9 items-center border-b border-slate-100 pr-2 ${
          selectedKey === node.key ? 'bg-sky-50' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${Math.min(depth, 4) * 1.25 + 0.25}rem` }}
        data-cy={`competence-tree-outline-node-${node.key}`}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            aria-expanded={!collapsed}
            aria-label={t(
              collapsed
                ? 'manage.competenceTree.expandNode'
                : 'manage.competenceTree.collapseNode'
            )}
            title={t(
              collapsed
                ? 'manage.competenceTree.expandNode'
                : 'manage.competenceTree.collapseNode'
            )}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-500"
            data-cy={`competence-tree-toggle-node-${node.key}`}
          >
            <FontAwesomeIcon
              icon={collapsed ? faChevronRight : faChevronDown}
              className="h-3 w-3"
            />
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.key)}
          aria-current={selectedKey === node.key ? 'true' : undefined}
          className="min-w-0 flex-1 truncate py-2 text-left text-sm"
          data-cy={`competence-tree-select-node-${node.key}`}
        >
          <span className="font-medium">{node.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            {t(
              node.parentKey
                ? 'manage.competenceTree.subcompetence'
                : 'manage.competenceTree.competence'
            )}
          </span>
        </button>
      </div>
      {!collapsed && children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <OutlineNode
              key={child.key}
              node={child}
              form={form}
              depth={depth + 1}
              selectedKey={selectedKey}
              collapsedKeys={collapsedKeys}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function HierarchyEditor({
  form,
  onChange,
  onStructuralCommand,
  selectedKey,
  onSelect,
  disabled,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  onStructuralCommand: (command: CompetenceTreeStructuralCommand) => void
  selectedKey: string | null
  onSelect: (key: string) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const focusNewNode = useRef(false)
  const selectedNode = form.nodes.find((node) => node.key === selectedKey)
  const roots = useMemo(() => getChildren(form.nodes, null), [form.nodes])
  const normalizedWeights = useMemo(
    () => getNormalizedRootWeights(form.nodes),
    [form.nodes]
  )

  const siblings = selectedNode
    ? getChildren(form.nodes, selectedNode.parentKey)
    : []
  const selectedIndex = selectedNode
    ? siblings.findIndex((node) => node.key === selectedNode.key)
    : -1
  const validParents = selectedNode
    ? form.nodes.filter((candidate) =>
        candidate.key === selectedNode.parentKey
          ? true
          : canReparentNode({
              form,
              nodeKey: selectedNode.key,
              parentKey: candidate.key,
            })
      )
    : []

  const updateSelectedNode = (
    update: (node: CompetenceTreeNodeForm) => CompetenceTreeNodeForm
  ) => {
    if (!selectedNode) return
    onChange({
      ...form,
      nodes: form.nodes.map((node) =>
        node.key === selectedNode.key ? update(node) : node
      ),
    })
  }

  useEffect(() => {
    if (!focusNewNode.current || !selectedKey) return

    const frame = window.requestAnimationFrame(() => {
      focusNewNode.current = false
      document
        .querySelector<HTMLElement>(
          'input[data-cy="competence-tree-node-name"], [data-cy="competence-tree-node-name"] input'
        )
        ?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedKey])

  const addRoot = () => {
    focusNewNode.current = true
    onStructuralCommand({
      type: 'addRoot',
      name: t('manage.competenceTree.newCompetence'),
    })
  }

  const addChild = () => {
    if (!selectedNode) return
    focusNewNode.current = true
    onStructuralCommand({
      type: 'addChild',
      parentKey: selectedNode.key,
      name: t('manage.competenceTree.newSubcompetence'),
    })
    setCollapsedKeys((current) => {
      const next = new Set(current)
      next.delete(selectedNode.key)
      return next
    })
  }

  return (
    <section
      id="competence-tree-section-nodes"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-hierarchy"
    >
      <div className="mb-4">
        <h2
          id="competence-tree-hierarchy-title"
          className="text-lg font-semibold"
        >
          {t('manage.competenceTree.hierarchyTitle')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('manage.competenceTree.hierarchyDescription')}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)]">
        <div>
          <div className="mb-2 flex justify-end">
            <Button
              onClick={addRoot}
              disabled={disabled}
              data={{ cy: 'competence-tree-add-root' }}
            >
              <Button.Icon icon={faPlus} />
              <Button.Label>
                {t('manage.competenceTree.addRootCompetence')}
              </Button.Label>
            </Button>
          </div>
          <div className="max-h-140 overflow-auto border border-slate-300 bg-white">
            <ul aria-labelledby="competence-tree-hierarchy-title">
              {roots.map((root) => (
                <OutlineNode
                  key={root.key}
                  node={root}
                  form={form}
                  depth={0}
                  selectedKey={selectedKey}
                  collapsedKeys={collapsedKeys}
                  onSelect={onSelect}
                  onToggle={(key) =>
                    setCollapsedKeys((current) => {
                      const next = new Set(current)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="border border-slate-300 p-4">
          {selectedNode ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">
                    {t('manage.competenceTree.selectedNode')}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {getBreadcrumb(form.nodes, selectedNode.key)}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    onClick={addChild}
                    disabled={disabled || !canAddChild(form, selectedNode.key)}
                    title={t(
                      getNodeDepth(form.nodes, selectedNode.key) >=
                        form.maxDepth
                        ? 'manage.competenceTree.maxDepthReached'
                        : 'manage.competenceTree.addSubcompetence'
                    )}
                    data={{ cy: 'competence-tree-node-add-child' }}
                    className={{ root: 'h-8' }}
                  >
                    <Button.Icon icon={faPlus} />
                    <Button.Label>
                      {t('manage.competenceTree.addSubcompetence')}
                    </Button.Label>
                  </Button>
                  <IconAction
                    icon={faArrowUp}
                    label={t('manage.competenceTree.moveUp')}
                    onClick={() =>
                      onStructuralCommand({
                        type: 'move',
                        nodeKey: selectedNode.key,
                        direction: -1,
                      })
                    }
                    disabled={disabled || selectedIndex <= 0}
                    dataCy="competence-tree-node-up"
                  />
                  <IconAction
                    icon={faArrowDown}
                    label={t('manage.competenceTree.moveDown')}
                    onClick={() =>
                      onStructuralCommand({
                        type: 'move',
                        nodeKey: selectedNode.key,
                        direction: 1,
                      })
                    }
                    disabled={
                      disabled ||
                      selectedIndex < 0 ||
                      selectedIndex === siblings.length - 1
                    }
                    dataCy="competence-tree-node-down"
                  />
                  <IconAction
                    icon={faCopy}
                    label={t('manage.competenceTree.duplicateBranch')}
                    onClick={() =>
                      onStructuralCommand({
                        type: 'duplicate',
                        nodeKey: selectedNode.key,
                      })
                    }
                    disabled={disabled}
                    dataCy="competence-tree-node-duplicate"
                  />
                  <IconAction
                    icon={faTrashCan}
                    label={t('manage.competenceTree.deleteBranch')}
                    onClick={() => setDeleteKey(selectedNode.key)}
                    disabled={
                      disabled ||
                      (selectedNode.parentKey === null && roots.length === 1)
                    }
                    destructive
                    dataCy="competence-tree-node-delete"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  value={selectedNode.name}
                  onChange={(name) =>
                    updateSelectedNode((node) => ({ ...node, name }))
                  }
                  label={t('manage.competenceTree.nodeName')}
                  disabled={disabled}
                  required
                  data={{ cy: 'competence-tree-node-name' }}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {t('manage.competenceTree.parent')}
                  </label>
                  <Select
                    value={selectedNode.parentKey ?? undefined}
                    onChange={(parentKey) =>
                      onStructuralCommand({
                        type: 'reparent',
                        nodeKey: selectedNode.key,
                        parentKey,
                      })
                    }
                    disabled={disabled || selectedNode.parentKey === null}
                    placeholder={t('manage.competenceTree.rootNode')}
                    items={validParents.map((parent) => ({
                      value: parent.key,
                      label: getBreadcrumb(form.nodes, parent.key),
                      data: {
                        cy: `competence-tree-node-parent-option-${parent.key}`,
                      },
                    }))}
                    data={{ cy: 'competence-tree-node-parent' }}
                    className={{ trigger: 'h-9 w-full' }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <TextareaField
                  value={selectedNode.description}
                  onChange={(description) =>
                    updateSelectedNode((node) => ({ ...node, description }))
                  }
                  label={t('manage.competenceTree.nodeDescription')}
                  disabled={disabled}
                  data={{ cy: 'competence-tree-node-description' }}
                  className={{ input: 'min-h-20' }}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-sm font-medium">
                    {t('manage.competenceTree.nodeType')}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t(
                      selectedNode.parentKey
                        ? 'manage.competenceTree.subcompetence'
                        : 'manage.competenceTree.competence'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {t('manage.competenceTree.depth')}
                  </div>
                  <div className="text-sm text-slate-600">
                    {getNodeDepth(form.nodes, selectedNode.key)} /{' '}
                    {form.maxDepth}
                  </div>
                </div>
                {selectedNode.parentKey === null && (
                  <div>
                    <NumberField
                      value={selectedNode.weight}
                      onChange={(value) =>
                        updateSelectedNode((node) => ({
                          ...node,
                          weight: Number(value || 0),
                        }))
                      }
                      min={0}
                      precision={3}
                      label={t('manage.competenceTree.rootWeight')}
                      disabled={disabled}
                      data={{ cy: 'competence-tree-node-weight' }}
                    />
                    <div className="mt-1 text-xs text-slate-600">
                      {t('manage.competenceTree.normalizedWeight', {
                        percentage: (
                          (normalizedWeights.get(selectedNode.key) ?? 0) * 100
                        ).toFixed(1),
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {t('manage.competenceTree.noNodeSelected')}
            </p>
          )}
        </div>
      </div>

      {deleteKey && (
        <ConfirmationModal
          title={t('manage.competenceTree.deleteBranchTitle')}
          message={t('manage.competenceTree.deleteBranchWarning', {
            assignments: form.assignments.filter((assignment) => {
              const removed = getDescendantKeys(form.nodes, deleteKey)
              removed.add(deleteKey)
              return removed.has(assignment.leafKey)
            }).length,
          })}
          confirmLabel={t('manage.competenceTree.deleteBranch')}
          cancelLabel={t('manage.competenceTree.cancel')}
          destructive
          onConfirm={() => {
            onStructuralCommand({ type: 'delete', nodeKey: deleteKey })
            setDeleteKey(null)
          }}
          onClose={() => setDeleteKey(null)}
          dataCy="competence-tree-delete-branch-modal"
        />
      )}
    </section>
  )
}

export default HierarchyEditor
