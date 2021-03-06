import React from 'react';
import { t } from 'app/i18next-t';
import './loadout-popup.scss';
import { DimStore } from '../inventory/store-types';
import { RootState, ThunkDispatchProp } from '../store/reducers';
import { previousLoadoutSelector, loadoutsSelector } from './reducer';
import { currentAccountSelector } from '../accounts/reducer';
import { getBuckets as d2GetBuckets } from '../destiny2/d2-buckets';
import { getBuckets as d1GetBuckets } from '../destiny1/d1-buckets';
import _ from 'lodash';
import { connect } from 'react-redux';
import {
  maxLightLoadout,
  itemLevelingLoadout,
  gatherEngramsLoadout,
  searchLoadout,
  randomLoadout,
  maxLightItemSet
} from './auto-loadouts';
import { querySelector } from '../shell/reducer';
import { newLoadout, getLight, convertToLoadoutItem } from './loadout-utils';
import { D1FarmingService } from '../farming/farming.service';
import { D2FarmingService } from '../farming/d2farming.service';
import {
  makeRoomForPostmaster,
  pullFromPostmaster,
  pullablePostmasterItems,
  totalPostmasterItems
} from './postmaster';
import { queueAction } from '../inventory/action-queue';
import {
  AppIcon,
  addIcon,
  searchIcon,
  levellingIcon,
  sendIcon,
  banIcon,
  undoIcon,
  deleteIcon,
  editIcon,
  engramIcon,
  powerActionIcon,
  powerIndicatorIcon,
  globeIcon,
  faRandom,
  hunterIcon,
  warlockIcon,
  titanIcon
} from '../shell/icons';
import { DimItem } from '../inventory/item-types';
import { searchFilterSelector } from '../search/search-filters';
import PressTip from '../dim-ui/PressTip';
import { showNotification } from '../notifications/notifications';
import { DestinyAccount } from 'app/accounts/destiny-account';
import { createSelector } from 'reselect';
import { getArtifactBonus, maxPowerString } from 'app/inventory/d2-stores';
import { Loadout } from './loadout-types';
import { editLoadout } from './LoadoutDrawer';
import { deleteLoadout } from './loadout-storage';
import { applyLoadout } from './loadout-apply';
import { fromEquippedTypes } from './LoadoutDrawerContents';
import { storesSelector } from 'app/inventory/reducer';
import { DestinyClass } from 'bungie-api-ts/destiny2';

const loadoutIcon = {
  [DestinyClass.Unknown]: globeIcon,
  [DestinyClass.Hunter]: hunterIcon,
  [DestinyClass.Warlock]: warlockIcon,
  [DestinyClass.Titan]: titanIcon
};

interface ProvidedProps {
  dimStore: DimStore;
  onClick(e): void;
}

interface StoreProps {
  account: DestinyAccount;
  previousLoadout?: Loadout;
  loadouts: Loadout[];
  query: string;
  classTypeId: DestinyClass;
  stores: DimStore[];
  searchFilter(item: DimItem): boolean;
}

type Props = ProvidedProps & StoreProps & ThunkDispatchProp;

function mapStateToProps() {
  const loadoutsForPlatform = createSelector(
    loadoutsSelector,
    (_, { dimStore }: ProvidedProps) => dimStore,
    (loadouts, dimStore) =>
      _.sortBy(
        loadouts.filter(
          (loadout) =>
            dimStore.classType === DestinyClass.Unknown ||
            loadout.classType === DestinyClass.Unknown ||
            loadout.classType === dimStore.classType
        ),
        (l) => l.name
      )
  );

  return (state: RootState, ownProps: ProvidedProps): StoreProps => {
    const { dimStore } = ownProps;

    return {
      previousLoadout: previousLoadoutSelector(state, ownProps.dimStore.id),
      loadouts: loadoutsForPlatform(state, ownProps),
      query: querySelector(state),
      searchFilter: searchFilterSelector(state),
      classTypeId: dimStore.classType,
      account: currentAccountSelector(state)!,
      stores: storesSelector(state)
    };
  };
}

class LoadoutPopup extends React.Component<Props> {
  render() {
    const { dimStore, stores, previousLoadout, loadouts, query, onClick } = this.props;
    const sortedLoadouts = _.sortBy(loadouts, (loadout) => loadout.name);

    // TODO: it'd be nice to memoize some of this - we'd need a memoized map of selectors!
    const hasClassified = dimStore
      .getStoresService()
      .getAllItems()
      .some(
        (i) =>
          i.classified &&
          (i.location.sort === 'Weapons' || i.location.sort === 'Armor' || i.type === 'Ghost')
      );

    const maxLight = getLight(dimStore, maxLightItemSet(stores, dimStore));
    const artifactLight = getArtifactBonus(dimStore);
    const maxLightValue = maxPowerString(maxLight, hasClassified, artifactLight);

    const numPostmasterItems = dimStore.isDestiny2() ? pullablePostmasterItems(dimStore).length : 0;
    const numPostmasterItemsTotal = totalPostmasterItems(dimStore);

    return (
      <div className="loadout-popup-content" onClick={onClick} role="menu">
        <ul className="loadout-list">
          <li className="loadout-set">
            <span onClick={this.newLoadout}>
              <AppIcon icon={addIcon} />
              <span>{t('Loadouts.Create')}</span>
            </span>
            <span onClick={this.newLoadoutFromEquipped}>{t('Loadouts.FromEquipped')}</span>
          </li>

          {query.length > 0 && (
            <li className="loadout-set">
              <span onClick={this.searchLoadout}>
                <AppIcon icon={searchIcon} />
                <span>{t('Loadouts.ApplySearch', { query })}</span>
              </span>
            </li>
          )}

          {!dimStore.isVault && (
            <>
              <li className="loadout-set">
                <span onClick={this.maxLightLoadout}>
                  <PressTip tooltip={hasClassified ? t('Loadouts.Classified') : ''}>
                    <span className="light">
                      <AppIcon icon={powerIndicatorIcon} />
                      {maxLightValue}
                    </span>
                  </PressTip>
                  <AppIcon icon={powerActionIcon} />
                  <span>
                    {dimStore.destinyVersion === 2
                      ? t('Loadouts.MaximizePower')
                      : t('Loadouts.MaximizeLight')}
                  </span>
                </span>
              </li>

              {dimStore.isDestiny1() && (
                <>
                  <li className="loadout-set">
                    <span onClick={this.itemLevelingLoadout}>
                      <AppIcon icon={levellingIcon} />
                      <span>{t('Loadouts.ItemLeveling')}</span>
                    </span>
                  </li>

                  {numPostmasterItemsTotal > 0 && (
                    <li className="loadout-set">
                      <span onClick={this.makeRoomForPostmaster}>
                        <AppIcon icon={sendIcon} />
                        <span>{t('Loadouts.MakeRoom')}</span>
                      </span>
                    </li>
                  )}
                </>
              )}

              {dimStore.isDestiny2() && numPostmasterItems > 0 && (
                <li className="loadout-set">
                  <span onClick={this.pullFromPostmaster}>
                    <AppIcon icon={sendIcon} />
                    <span className="badge">{numPostmasterItems}</span>{' '}
                    <span>{t('Loadouts.PullFromPostmaster')}</span>
                  </span>
                  <span onClick={this.makeRoomForPostmaster}>{t('Loadouts.PullMakeSpace')}</span>
                </li>
              )}
              {dimStore.isDestiny2() && numPostmasterItems === 0 && numPostmasterItemsTotal > 0 && (
                <li className="loadout-set">
                  <span onClick={this.makeRoomForPostmaster}>
                    <AppIcon icon={sendIcon} />
                    <span>{t('Loadouts.MakeRoom')}</span>
                  </span>
                </li>
              )}
            </>
          )}

          {dimStore.isDestiny1() && (
            <li className="loadout-set">
              <span onClick={(e) => this.gatherEngramsLoadout(e, { exotics: true })}>
                <AppIcon icon={engramIcon} />
                <span>{t('Loadouts.GatherEngrams')}</span>
              </span>
              <span onClick={(e) => this.gatherEngramsLoadout(e, { exotics: false })}>
                <AppIcon icon={banIcon} /> <span>{t('Loadouts.GatherEngramsExceptExotics')}</span>
              </span>
            </li>
          )}

          <li className="loadout-set">
            <span onClick={this.randomLoadout}>
              <AppIcon icon={faRandom} />
              <span>
                {query.length > 0 ? t('Loadouts.RandomizeSearch') : t('Loadouts.Randomize')}
              </span>
            </span>
            {query.length === 0 && (
              <span onClick={(e) => this.randomLoadout(e, true)}>
                <span>{t('Loadouts.WeaponsOnly')}</span>
              </span>
            )}
          </li>

          {!dimStore.isVault && (
            <li className="loadout-set">
              <span onClick={this.startFarming}>
                <AppIcon icon={engramIcon} />
                <span>{t('FarmingMode.FarmingMode')}</span>
              </span>
            </li>
          )}

          {previousLoadout && (
            <li className="loadout-set">
              <span
                title={previousLoadout.name}
                onClick={(e) => this.applyLoadout(previousLoadout, e, true)}
              >
                <AppIcon icon={undoIcon} />
                {previousLoadout.name}
              </span>
              <span onClick={(e) => this.applyLoadout(previousLoadout, e)}>
                <span>{t('Loadouts.RestoreAllItems')}</span>
              </span>
            </li>
          )}

          {sortedLoadouts.map((loadout) => (
            <li key={loadout.id} className="loadout-set">
              <span title={loadout.name} onClick={(e) => this.applyLoadout(loadout, e)}>
                <AppIcon className="loadout-type-icon" icon={loadoutIcon[loadout.classType]} />
                {loadout.name}
              </span>
              <span
                className="delete"
                title={t('Loadouts.Delete')}
                onClick={() => this.deleteLoadout(loadout)}
              >
                <AppIcon icon={deleteIcon} />
              </span>
              <span
                title={t('Loadouts.Edit')}
                onClick={() => this.editLoadout(loadout, { isNew: false })}
              >
                <AppIcon icon={editIcon} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  private newLoadout = () => {
    this.editLoadout(newLoadout('', []));
  };

  private newLoadoutFromEquipped = () => {
    const { dimStore, classTypeId } = this.props;

    const items = dimStore.items.filter(
      (item) =>
        item.canBeInLoadout() &&
        item.equipped &&
        fromEquippedTypes.includes(item.type.toLowerCase())
    );
    const loadout = newLoadout(
      '',
      items.map((i) => convertToLoadoutItem(i, true))
    );
    loadout.classType = classTypeId;
    this.editLoadout(loadout);
  };

  private deleteLoadout = async (loadout: Loadout) => {
    const { dispatch } = this.props;
    if (confirm(t('Loadouts.ConfirmDelete', { name: loadout.name }))) {
      try {
        await dispatch(deleteLoadout(loadout));
      } catch (e) {
        showNotification({
          type: 'error',
          title: t('Loadouts.DeleteErrorTitle'),
          body: t('Loadouts.DeleteErrorDescription', {
            loadoutName: loadout.name,
            error: e.message
          })
        });
        console.error(e);
      }
    }
  };

  private editLoadout = (loadout: Loadout, { isNew = true } = {}) => {
    editLoadout(loadout, { showClass: true, isNew });
  };

  // TODO: move all these fancy loadouts to a new service

  private applyLoadout = (loadout: Loadout, e, filterToEquipped = false) => {
    const { dimStore } = this.props;
    e.preventDefault();

    if (filterToEquipped) {
      loadout = filterLoadoutToEquipped(loadout);
    }

    if (dimStore.destinyVersion === 1) {
      return D1FarmingService.interrupt(() => applyLoadout(dimStore, loadout, true));
    }

    if (dimStore.destinyVersion === 2) {
      return D2FarmingService.interrupt(() => applyLoadout(dimStore, loadout, true));
    }
  };

  // A dynamic loadout set up to level weapons and armor
  private itemLevelingLoadout = (e) => {
    const { dimStore } = this.props;
    const loadout = itemLevelingLoadout(dimStore.getStoresService(), dimStore);
    this.applyLoadout(loadout, e);
  };

  // Apply a loadout that's dynamically calculated to maximize Light level (preferring not to change currently-equipped items)
  private maxLightLoadout = (e) => {
    const { dimStore, stores } = this.props;
    const loadout = maxLightLoadout(stores, dimStore);
    this.applyLoadout(loadout, e);
  };

  // A dynamic loadout set up to level weapons and armor
  private gatherEngramsLoadout = (e, options: { exotics: boolean } = { exotics: false }) => {
    const { dimStore } = this.props;
    let loadout;
    try {
      loadout = gatherEngramsLoadout(dimStore.getStoresService(), options);
    } catch (e) {
      showNotification({ type: 'warning', title: t('Loadouts.GatherEngrams'), body: e.message });
      return;
    }
    this.applyLoadout(loadout, e);
  };

  private randomLoadout = (e, weaponsOnly = false) => {
    const { dimStore, searchFilter, query } = this.props;
    if (
      !window.confirm(
        weaponsOnly
          ? t('Loadouts.RandomizeWeapons')
          : query.length > 0
          ? t('Loadouts.RandomizeSearchPrompt', { query })
          : t('Loadouts.RandomizePrompt')
      )
    ) {
      e.preventDefault();
      return;
    }
    let loadout;
    try {
      loadout = randomLoadout(
        dimStore.getStoresService(),
        weaponsOnly ? (i) => i.bucket?.sort === 'Weapons' && searchFilter(i) : searchFilter
      );
    } catch (e) {
      showNotification({ type: 'warning', title: t('Loadouts.Random'), body: e.message });
      return;
    }
    this.applyLoadout(loadout, e);
  };

  // Move items matching the current search. Max 9 per type.
  private searchLoadout = (e) => {
    const { dimStore, searchFilter } = this.props;
    const loadout = searchLoadout(dimStore.getStoresService(), dimStore, searchFilter);
    this.applyLoadout(loadout, e);
  };

  private makeRoomForPostmaster = () => {
    const { dimStore } = this.props;
    const bucketsService = dimStore.destinyVersion === 1 ? d1GetBuckets : d2GetBuckets;
    return queueAction(() => makeRoomForPostmaster(dimStore, bucketsService));
  };

  private pullFromPostmaster = () => {
    const { dimStore } = this.props;
    return queueAction(() => pullFromPostmaster(dimStore));
  };

  private startFarming = () => {
    const { account, dimStore } = this.props;
    (dimStore.isDestiny2() ? D2FarmingService : D1FarmingService).start(account, dimStore.id);
  };
}

export default connect<StoreProps>(mapStateToProps)(LoadoutPopup);

/**
 * Filter a loadout down to only the equipped items in the loadout.
 */
export function filterLoadoutToEquipped(loadout: Loadout) {
  return {
    ...loadout,
    items: loadout.items.filter((i) => i.equipped)
  };
}
