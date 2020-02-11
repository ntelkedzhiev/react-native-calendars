import React, {Component} from 'react';
import {FlatList, ActivityIndicator, View} from 'react-native';
import PropTypes from 'prop-types';
import XDate from 'xdate';
import { parseDate } from "../../interface";
import dateutils from '../../dateutils';
import Reservation from './reservation';
import styleConstructor from './style';

const SCROLL_THRESHOLD = 5;


class ReservationList extends Component {
  static displayName = 'IGNORE';

  static propTypes = {
    // specify your item comparison function for increased performance
    rowHasChanged: PropTypes.func,
    // specify how each item should be rendered in agenda
    renderItem: PropTypes.func,
    // specify how each date should be rendered. day can be undefined if the item is not first in that day.
    renderDay: PropTypes.func,
    // specify how empty date content with no items should be rendered
    renderEmptyDate: PropTypes.func,
    // callback that gets called when day changes while scrolling agenda list
    onDayChange: PropTypes.func,
    // onScroll ListView event
    onScroll: PropTypes.func,
    // the list of items that have to be displayed in agenda. If you want to render item as empty date
    // the value of date key kas to be an empty array []. If there exists no value for date key it is
    // considered that the date in question is not yet loaded
    reservations: PropTypes.object,
    selectedDay: PropTypes.instanceOf(XDate),
    topDay: PropTypes.instanceOf(XDate),
    refreshControl: PropTypes.element,
    refreshing: PropTypes.bool,
    onRefresh: PropTypes.func,
    onScrollBeginDrag: PropTypes.func,
    onScrollEndDrag: PropTypes.func,
    onMomentumScrollBegin: PropTypes.func,
    onMomentumScrollEnd: PropTypes.func,
    contentInset: PropTypes.object
  };

  state = {
    reservations: []
  };

  constructor(props) {
    super(props);

    this.styles = styleConstructor(props.theme);

    this.state = {
      reservations: []
    };

    this.heights=[];
    this.selectedDay = this.props.selectedDay;
    this.scrollOver = true;
    // this.state.reservations = this.getReservations(props).reservations;
  }

  UNSAFE_componentWillMount() {
    this.updateDataSource(this.getReservations(this.props).reservations);
  }

  updateDataSource(reservations) {
    this.setState({
      reservations
    });
  }

  UNSAFE_componentWillReceiveProps(props) {
    if (!dateutils.sameDate(props.topDay, this.props.topDay)) {
      this.setState(
        {
          reservations: []
        },
        () => {
          this.updateReservations(props);
        }
      );
    } else {
      this.updateReservations(props);
    }
  }

  updateReservations(props) {
    const reservations = this.getReservations(props);
    if (this.list && !dateutils.sameDate(props.selectedDay, this.selectedDay)) {
      let scrollPosition = 0;
      for (let i = 0; i < reservations.scrollPosition; i++) {
        scrollPosition += this.heights[i] || 0;
      }
      this.scrollOver = false;
      this.list.scrollToOffset({offset: scrollPosition, animated: true});
    }
    this.selectedDay = props.selectedDay;
    this.updateDataSource(reservations.reservations);
  }

  getReservations(props) {
    if (!props.reservations || !props.selectedDay) {
      return { reservations: [], scrollPosition: 0 };
    }

    const keys = Object.keys(props.reservations);
    keys.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const iterator = parseDate(keys[0]).clone();
    const lastIterator = parseDate(keys[keys.length - 1]).clone();

    let reservations = [];
    while (iterator.getTime() <= lastIterator) {
      const res = this.getReservationsForDay(iterator, props);
      reservations = reservations.concat(res);
      iterator.addDays(1);
    }

    const scrollPosition = this.calculateScrollPosition(
      reservations,
      props.selectedDay
    );
    return { reservations, scrollPosition };
  }

  getReservationsForDay(iterator, props) {
    const day = iterator.clone();
    const res = props.reservations[day.toString("yyyy-MM-dd")];
    if (res && res.length) {
      return res.map((reservation, i) => {
        return {
          reservation,
          date: i ? false : day,
          day
        };
      });
    } else if (res) {
      return [
        {
          date: iterator.clone(),
          day
        }
      ];
    } else {
      return false;
    }
  }

  scrollToInitialPosition() {
    const scrollPosition = this.calculateScrollPosition(
      this.state.reservations,
      this.props.selectedDay
    );
    let offset = 0;
    for (let i = 0; i < scrollPosition; i++) {
      offset += this.heights[i] || 0;
    }
    this.scrollOver = false;
    this.list.scrollToOffset({ offset, animated: false });
  }

  calculateScrollPosition(reservations, selectedDay) {
    let scrollPosition = 0;
    for (reservation of reservations) {
      if (
        reservation.day &&
        JSON.stringify(selectedDay[0]) === JSON.stringify(reservation.day[0])
      ) {
        break;
      }
      scrollPosition++;
    }
    return scrollPosition;
  }

  onScroll(event) {
    const yOffset = event.nativeEvent.contentOffset.y;
    this.props.onScroll(yOffset);
    let topRowOffset = 0;
    let topRow;
    const numberOfRows = this.heights.length;
    for (topRow = 0; topRow < numberOfRows; topRow++) {
      if (topRowOffset + this.heights[topRow] / 2 >= yOffset) {
        break;
      }
      topRowOffset += this.heights[topRow];
    }

    const row = this.state.reservations[topRow];
    if (!row) return;
    const day = row.day;
    const sameDate = dateutils.sameDate(day, this.selectedDay);
    if (!sameDate && this.scrollOver) {
      this.selectedDay = day.clone();
      this.props.onDayChange(day.clone());
    }

    if (this.props.onScrollThresholdReached) {
      if (topRow - SCROLL_THRESHOLD === 0) {
        const { reservations } = this.state;
        this.props.onScrollThresholdReached(
          reservations[0].day.toDateString(),
          "top"
        );
      } else if (topRow + SCROLL_THRESHOLD === numberOfRows) {
        const { reservations } = this.state;
        this.props.onScrollThresholdReached(
          reservations[reservations.length - 1].day.toDateString(),
          "bottom"
        );
      }
    }
  }

  onRowLayoutChange(ind, event) {
    this.heights[ind] = event.nativeEvent.layout.height;
    if (
      !this.state.setInitialPosition &&
      Object.keys(this.heights).length >=
        Math.floor(this.state.reservations.length / 2)
    ) {
      this.scrollToInitialPosition();
      this.setState({ setInitialPosition: true });
    }
  }

  onListTouch() {
    this.scrollOver = true;
  }

  renderRow({ item, index }) {
    return (
      <View onLayout={this.onRowLayoutChange.bind(this, index)}>
        <Reservation
          item={item}
          renderItem={this.props.renderItem}
          renderDay={this.props.renderDay}
          renderEmptyDate={this.props.renderEmptyDate}
          theme={this.props.theme}
          rowHasChanged={this.props.rowHasChanged}
        />
      </View>
    );
  }

  render() {
    const {reservations} = this.props;
    if (!reservations || !reservations[this.props.selectedDay.toString('yyyy-MM-dd')]) {
      if (this.props.renderEmptyData) {
        return this.props.renderEmptyData();
      }
      return (
        <ActivityIndicator style={{marginTop: 80}} color={this.props.theme && this.props.theme.indicatorColor}/>
      );
    }

    const opacity = this.state.setInitialPosition
      ? 1
      : !this.props.earliestDay
      ? 1
      : 0;
    const numToRender =
      this.state.reservations.length === 1
        ? 1
        : Math.floor(this.state.reservations.length / 2);

    return (
      <FlatList
        ref={c => (this.list = c)}
        style={{ ...this.props.style, opacity }}
        contentContainerStyle={this.styles.content}
        renderItem={this.renderRow.bind(this)}
        data={this.state.reservations}
        onScroll={this.onScroll.bind(this)}
        initialNumToRender={numToRender}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={200}
        onMoveShouldSetResponderCapture={() => {
          this.onListTouch();
          return false;
        }}
        keyExtractor={(item, index) => String(index)}
        refreshControl={this.props.refreshControl}
        refreshing={this.props.refreshing || false}
        onRefresh={this.props.onRefresh}
        onScrollBeginDrag={this.props.onScrollBeginDrag}
        onScrollEndDrag={this.props.onScrollEndDrag}
        onMomentumScrollBegin={this.props.onMomentumScrollBegin}
        onMomentumScrollEnd={this.props.onMomentumScrollEnd}
        contentInset={this.props.contentInset}
      />
    );
  }
}

export default ReservationList;
