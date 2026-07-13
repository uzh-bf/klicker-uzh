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
import { AdaptiveNodeKind } from '@klicker-uzh/graphql/dist/ops'
import {
  NumberField,
  Select,
  TextareaField,
  TextField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import ConfirmationModal from './ConfirmationModal'
import IconAction from './IconAction'
import {
  canReparentNode,
  duplicateBranch,
  getBreadcrumb,
  getChildren,
  getDescendantKeys,
  getNextLocalKey,
  getNodeDepth,
  getNormalizedRootWeights,
  moveNodeAmongSiblings,
  removeBranch,
  reparentNode,
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
    <div>
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
      {!collapsed &&
        children.map((child) => (
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
    </div>
  )
}

function HierarchyEditor({
  form,
  onChange,
  disabled,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => getChildren(form.nodes, null)[0]?.key ?? null
  )
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const selectedNode = form.nodes.find((node) => node.key === selectedKey)
  const roots = useMemo(() => getChildren(form.nodes, null), [form.nodes])
  const normalizedWeights = useMemo(
    () => getNormalizedRootWeights(form.nodes),
    [form.nodes]
  )

  useEffect(() => {
    if (selectedKey && form.nodes.some((node) => node.key === selectedKey)) {
      return
    }
    setSelectedKey(getChildren(form.nodes, null)[0]?.key ?? null)
  }, [form.nodes, selectedKey])

  const siblings = selectedNode
    ? getChildren(form.nodes, selectedNode.parentKey)
    : []
  const selectedIndex = selectedNode
    ? siblings.findIndex((node) => node.key === selectedNode.key)
    : -1
  const validParents = selectedNode
    ? form.nodes.filter((candidate) =>
        canReparentNode({
          nodes: form.nodes,
          nodeKey: selectedNode.key,
          parentKey: candidate.key,
          maxDepth: form.maxDepth,
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

  const addChild = () => {
    if (!selectedNode) return
    const depth = getNodeDepth(form.nodes, selectedNode.key)
    if (depth >= form.maxDepth) return

    const childKey = getNextLocalKey(
      form.nodes.map((node) => node.key),
      'node'
    )
    const wasLeaf = getChildren(form.nodes, selectedNode.key).length === 0
    const child: CompetenceTreeNodeForm = {
      key: childKey,
      parentKey: selectedNode.key,
      kind: AdaptiveNodeKind.Subcompetence,
      name: t('manage.competenceTree.newSubcompetence'),
      description: '',
      order: getChildren(form.nodes, selectedNode.key).length,
      weight: 1,
    }

    onChange({
      ...form,
      nodes: [...form.nodes, child],
      coverages: wasLeaf
        ? form.coverages.map((coverage) =>
            coverage.leafKey === selectedNode.key
              ? { ...coverage, leafKey: childKey }
              : coverage
          )
        : [
            ...form.coverages,
            ...form.levels.map((level) => ({
              leafKey: childKey,
              levelKey: level.key,
              targetItemCount: 5,
              enabled: true,
            })),
          ],
      assignments: wasLeaf
        ? form.assignments.map((assignment) =>
            assignment.leafKey === selectedNode.key
              ? { ...assignment, leafKey: childKey }
              : assignment
          )
        : form.assignments,
    })
    setCollapsedKeys((current) => {
      const next = new Set(current)
      next.delete(selectedNode.key)
      return next
    })
    setSelectedKey(childKey)
  }

  return (
    <section
      id="competence-tree-section-nodes"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-hierarchy"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {t('manage.competenceTree.hierarchyTitle')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('manage.competenceTree.hierarchyDescription')}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)]">
        <div className="max-h-140 overflow-auto border border-slate-300 bg-white">
          {roots.map((root) => (
            <OutlineNode
              key={root.key}
              node={root}
              form={form}
              depth={0}
              selectedKey={selectedKey}
              collapsedKeys={collapsedKeys}
              onSelect={setSelectedKey}
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
                  <IconAction
                    icon={faPlus}
                    label={t(
                      getNodeDepth(form.nodes, selectedNode.key) >=
                        form.maxDepth
                        ? 'manage.competenceTree.maxDepthReached'
                        : 'manage.competenceTree.addChild'
                    )}
                    onClick={addChild}
                    disabled={
                      disabled ||
                      getNodeDepth(form.nodes, selectedNode.key) >=
                        form.maxDepth
                    }
                    dataCy="competence-tree-node-add-child"
                  />
                  <IconAction
                    icon={faArrowUp}
                    label={t('manage.competenceTree.moveUp')}
                    onClick={() =>
                      onChange({
                        ...form,
                        nodes: moveNodeAmongSiblings(
                          form.nodes,
                          selectedNode.key,
                          -1
                        ),
                      })
                    }
                    disabled={disabled || selectedIndex <= 0}
                    dataCy="competence-tree-node-up"
                  />
                  <IconAction
                    icon={faArrowDown}
                    label={t('manage.competenceTree.moveDown')}
                    onClick={() =>
                      onChange({
                        ...form,
                        nodes: moveNodeAmongSiblings(
                          form.nodes,
                          selectedNode.key,
                          1
                        ),
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
                      onChange(duplicateBranch(form, selectedNode.key))
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
                      onChange({
                        ...form,
                        nodes: reparentNode(
                          form.nodes,
                          selectedNode.key,
                          parentKey,
                          form.maxDepth
                        ),
                      })
                    }
                    disabled={disabled || selectedNode.parentKey === null}
                    placeholder={t('manage.competenceTree.rootNode')}
                    items={validParents.map((parent) => ({
                      value: parent.key,
                      label: getBreadcrumb(form.nodes, parent.key),
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
            onChange(removeBranch(form, deleteKey))
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
