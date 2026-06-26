import { useState, useEffect, useCallback } from 'react';
import { graphqlRequest } from '../utils/graphql';
import { getInitials } from '../utils/helpers';
import { getStatusEmoji, POLL_INTERVAL_MS, POTION_ORDER_STATUSES } from '../constants';
import { CreatePotionModal } from './modals/CreatePotionModal';
import { ReassignModal } from './modals/ReassignModal';
import type { PotionOrder, AlchemistProfileMinimal } from '../types';
import { resolveDraggedOrderId, shouldApplyStatusChange } from '../utils/validation';
import styles from './PotionBoard.module.css';

const GET_POTION_ORDERS = `
  query GetPotionOrders($filter: PotionOrderFilter) {
    potionOrders(filter: $filter) {
      id
      customer_name
      location
      potion
      assigned_alchemist
      status
      notes
    }
  }
`;

const UPDATE_POTION_ORDER_STATUS = `
  mutation UpdatePotionOrderStatus($id: ID!, $status: String!) {
    updatePotionOrderStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

const UPDATE_POTION_ORDER_ALCHEMIST = `
  mutation UpdatePotionOrderAlchemist($id: ID!, $assigned_alchemist: String!) {
    updatePotionOrderAlchemist(id: $id, assigned_alchemist: $assigned_alchemist) {
      id
      assigned_alchemist
    }
  }
`;

const ADD_POTION_ORDER = `
  mutation AddPotionOrder($input: PotionOrderInput!) {
    addPotionOrder(input: $input) {
      id
      customer_name
      location
      potion
      assigned_alchemist
      status
      notes
    }
  }
`;

interface PotionBoardProps {
  alchemistName: string;
  profileUpdateTrigger: number;
}

export function PotionBoard({ alchemistName, profileUpdateTrigger }: PotionBoardProps) {
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PotionOrder | null>(null);
  const [availableAlchemists, setAvailableAlchemists] = useState<string[]>([]);
  const [alchemistProfiles, setAlchemistProfiles] = useState<Map<string, AlchemistProfileMinimal>>(new Map());
  const [actionError, setActionError] = useState<string | null>(null);

  const [data, setData] = useState<{ potionOrders: PotionOrder[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const result = await graphqlRequest<{ potionOrders: PotionOrder[] }>(GET_POTION_ORDERS, {
        filter: showAllOrders ? {} : { assigned_alchemist: alchemistName }
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [showAllOrders, alchemistName]);

  useEffect(() => {
    fetchOrders();
    const intervalId = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  const updatePotionOrderStatus = async ({ variables }: { variables: { id: string; status: string } }) => {
    await graphqlRequest(UPDATE_POTION_ORDER_STATUS, variables);
    await fetchOrders();
  };

  const updatePotionOrderAlchemist = async ({ variables }: { variables: { id: string; assigned_alchemist: string } }) => {
    await graphqlRequest(UPDATE_POTION_ORDER_ALCHEMIST, variables);
    await fetchOrders();
  };

  const addPotionOrder = async ({ variables }: { variables: { input: Record<string, unknown> } }) => {
    await graphqlRequest(ADD_POTION_ORDER, variables);
    await fetchOrders();
  };

  useEffect(() => {
    const fetchAlchemists = async () => {
      try {
        const response = await fetch('/api/alchemists');
        if (!response.ok) {
          throw new Error('Failed to fetch alchemist list');
        }
        const data: { name: string }[] = await response.json();
        setAvailableAlchemists(data.map(a => a.name));

        const profilesMap = new Map<string, { profile_image?: string | null }>();
        await Promise.all(
          data.map(async (a) => {
            try {
              const profileResponse = await fetch(`/api/alchemist/${encodeURIComponent(a.name)}`);
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                profilesMap.set(a.name, profileData);
              }
            } catch (error) {
              console.warn(`Failed to fetch profile for ${a.name}:`, error);
            }
          })
        );
        setAlchemistProfiles(profilesMap);
      } catch (error) {
        console.error('Failed to fetch alchemists:', error);
        setActionError('Failed to load alchemist list. Some features may be unavailable.');
      }
    };
    fetchAlchemists();
  }, [profileUpdateTrigger]);

  /** Persists a new kanban column via GraphQL and refreshes local order state. */
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setActionError(null);
    try {
      await updatePotionOrderStatus({
        variables: { id: orderId, status: newStatus }
      });
    } catch (err: any) {
      setActionError(err.message || 'Failed to update potion order status');
    }
  };

  /** Stores the dragged order id on both React state and dataTransfer for reliable drop handling. */
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedItem(orderId);
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  /**
   * Handles drops on kanban columns and cards (Bug 2b).
   * Cards must register drop handlers because HTML5 DnD targets the element under the cursor.
   */
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    const orderId = resolveDraggedOrderId(e.dataTransfer.getData('text/plain'), draggedItem);
    if (!orderId) {
      setDraggedItem(null);
      return;
    }

    const currentOrder = data?.potionOrders.find((order) => order.id === orderId);
    if (!shouldApplyStatusChange(orderId, currentOrder?.status, newStatus)) {
      setDraggedItem(null);
      return;
    }

    await handleStatusChange(orderId, newStatus);
    setDraggedItem(null);
  };

  const handleReassign = async (newAlchemist: string) => {
    if (!selectedOrder) return;

    setActionError(null);
    try {
      await updatePotionOrderAlchemist({
        variables: { id: selectedOrder.id, assigned_alchemist: newAlchemist }
      });
      setShowReassignModal(false);
      setSelectedOrder(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reassign potion order');
      throw err;
    }
  };

  const getOrdersByStatus = (status: string): PotionOrder[] => {
    if (!data?.potionOrders) return [];
    return data.potionOrders.filter((order: PotionOrder) => order.status === status);
  };

  const handleAddPotionOrder = async (input: {
    customer_name: string;
    location: string;
    potion: string;
    assigned_alchemist: string;
    notes: string;
  }) => {
    setActionError(null);
    await addPotionOrder({ variables: { input } });
  };

  return (
    <div>
      <div className="component-header">
        <h2 className="component-title">Potion Orders</h2>
        <div className={styles.headerControls}>
          <button
            className="button button-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Order
          </button>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showAllOrders}
              onChange={(e) => setShowAllOrders(e.target.checked)}
            />
            <span>Show All Orders</span>
          </label>
        </div>
      </div>

      {loading && <div className="loading">Loading potion orders...</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {actionError && <div className="error">{actionError}</div>}

      {data && (
        <div className="kanban-board">
          {POTION_ORDER_STATUSES.map(status => (
            <div
              key={status}
              className={`kanban-column ${dragOverColumn === status ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="kanban-column-header">
                <span>{getStatusEmoji(status)} {status}</span>
                <span className={styles.columnCountBadge}>
                  {getOrdersByStatus(status).length}
                </span>
              </div>

              {getOrdersByStatus(status).map((order: PotionOrder) => {
                const alchemistProfile = alchemistProfiles.get(order.assigned_alchemist);
                return (
                  <div
                    key={order.id}
                    className={`kanban-card ${draggedItem === order.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order.id)}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardPotionInfo}>
                        <div className={styles.cardPotionTitle}>
                          {order.potion}
                        </div>
                        <div className={styles.cardCustomerName}>
                          From: {order.customer_name}
                        </div>
                      </div>

                      <div
                        className={`alchemist-avatar-container ${styles.avatarContainer}`}
                        title={order.assigned_alchemist}
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowReassignModal(true);
                        }}
                      >
                        {alchemistProfile?.profile_image ? (
                          <img
                            src={alchemistProfile.profile_image}
                            alt={order.assigned_alchemist}
                            className={styles.avatarImage}
                          />
                        ) : (
                          <div className={styles.avatarInitials}>
                            {getInitials(order.assigned_alchemist)}
                          </div>
                        )}
                        <div className="reassign-overlay">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <div className={styles.cardNotes}>
                        {order.notes}
                      </div>
                    )}
                  </div>
                );
              })}

              {getOrdersByStatus(status).length === 0 && (
                <div className={styles.emptyColumn}>
                  No potions in this stage
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePotionModal
          alchemistName={alchemistName}
          availableAlchemists={availableAlchemists}
          onClose={() => {
            setShowCreateModal(false);
            setActionError(null);
          }}
          onSubmit={handleAddPotionOrder}
        />
      )}

      {showReassignModal && (
        <ReassignModal
          selectedOrder={selectedOrder}
          availableAlchemists={availableAlchemists}
          alchemistProfiles={alchemistProfiles}
          onClose={() => {
            setShowReassignModal(false);
            setSelectedOrder(null);
            setActionError(null);
          }}
          onReassign={handleReassign}
        />
      )}
    </div>
  );
}
