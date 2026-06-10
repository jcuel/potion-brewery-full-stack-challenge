import { useState, useEffect } from 'react';
import { getInitials, calculateYearsOfService, formatDate, parseLocalDate } from '../utils/helpers';
import { compressImage } from '../utils/imageCompression';
import type { AlchemistProfile } from '../types';
import styles from './AlchemistProfile.module.css';

interface AlchemistProfileProps {
  alchemistName: string;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  onProfileUpdate: () => void;
}

export function AlchemistProfile({ alchemistName, isEditing, setIsEditing, onProfileUpdate }: AlchemistProfileProps) {
  const [profile, setProfile] = useState<AlchemistProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    service_start_date: '',
    profile_image: null as string | null
  });

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/alchemist/${encodeURIComponent(alchemistName)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load alchemist profile');
      }

      setProfile(data);
      setFormData({
        service_start_date: data.service_start_date,
        profile_image: data.profile_image
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load alchemist profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const startDate = parseLocalDate(formData.service_start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      setError('Service start date cannot be in the future');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/alchemist/${encodeURIComponent(alchemistName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfile(data);
      setIsEditing(false);
      onProfileUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);

    try {
      const compressedBase64 = await compressImage(file);
      setFormData({ ...formData, profile_image: compressedBase64 });
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [alchemistName]);

  return (
    <div>
      {loading && <div className="loading">Loading profile...</div>}
      {error && <div className="error">Error: {error}</div>}

      {profile && !isEditing && (
        <div className={styles.profileContainer}>
          <div>
            {profile.profile_image ? (
              <img src={profile.profile_image} alt={profile.name} className="profile-image" />
            ) : (
              <div className="profile-initials">
                {getInitials(profile.name)}
              </div>
            )}
          </div>

          <div className={styles.profileStats}>
            <div>
              <div className={styles.statLabel}>Name</div>
              <div className={styles.statValue}>{profile.name}</div>
            </div>
            <div>
              <div className={styles.statLabel}>Years of Service</div>
              <div
                className={styles.statValue}
                style={{ cursor: 'help' }}
                title={`Started: ${formatDate(profile.service_start_date)}`}
              >
                {calculateYearsOfService(profile.service_start_date)}
              </div>
            </div>
            <div>
              <div className={styles.statLabel}>Potions Completed</div>
              <div className={styles.statValue}>{profile.potions_completed.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <form onSubmit={updateProfile}>
          <div className={styles.editFormContainer}>
            <div className={styles.imageUploadSection}>
              {formData.profile_image ? (
                <img src={formData.profile_image} alt="Preview" className="profile-image" />
              ) : (
                <div className="profile-initials">
                  {profile ? getInitials(profile.name) : '?'}
                </div>
              )}
              <label className="button button-secondary image-upload-btn">
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            </div>

            <div className={styles.formFieldsContainer}>
              <div className="form-group">
                <label className="form-label">Service Start Date:</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.service_start_date}
                  onChange={(e) => setFormData({ ...formData, service_start_date: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    if (profile) {
                      setFormData({
                        service_start_date: profile.service_start_date,
                        profile_image: profile.profile_image
                      });
                    }
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
